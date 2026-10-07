package storyteller

import (
	"fmt"
	"strings"

	storytellerModel "faryne.dev/model/entity/storyteller"
)

// readingRecordRepository 只列出閱讀進度需要的 repo 方法，方便測試換成假的實作。
type readingRecordRepository interface {
	ProjectByPublicIDForReader(userID uint64, publicID string) (*storytellerModel.Project, error)
	Stories(projectID uint64) ([]storytellerModel.Story, error)
	PublishedStories(projectID uint64) ([]storytellerModel.Story, error)
	ReaderLores(projectID uint64, includeDrafts bool) ([]storytellerModel.Lore, error)
	ReadingRecords(userID, projectID uint64) ([]storytellerModel.ReadingRecord, error)
	UpsertReadingRecords(rows []storytellerModel.ReadingRecord) error
}

// ReadingRecords 回傳讀者在這個專案的閱讀進度，只包含目前還讀得到的內容
// （已取消公開或刪除的篇章、設定不回傳，避免列表顯示讀者點不進去的東西）。
func (s *Service) ReadingRecords(userID uint64, projectPublicID string) ([]storytellerModel.ReadingRecordOutput, error) {
	return readingRecords(s.repo, userID, projectPublicID)
}

// SaveReadingRecords 批次寫入進度後回傳最新的完整列表，前端直接拿來覆蓋快取。
// 讀不到的對象（未公開、已刪除、不屬於這個專案）直接略過不報錯：未登入時存在 localStorage
// 的舊紀錄，登入補寫時很可能已經失效，不能因為一筆壞資料讓整批失敗。
func (s *Service) SaveReadingRecords(userID uint64, projectPublicID string, inputs []storytellerModel.ReadingRecordInput) ([]storytellerModel.ReadingRecordOutput, error) {
	return saveReadingRecords(s.repo, userID, projectPublicID, inputs)
}

func readingRecords(repo readingRecordRepository, userID uint64, projectPublicID string) ([]storytellerModel.ReadingRecordOutput, error) {
	project, targets, err := readableTargetsForReading(repo, userID, projectPublicID)
	if err != nil {
		return nil, err
	}
	rows, err := repo.ReadingRecords(userID, project.ID)
	if err != nil {
		return nil, err
	}
	out := make([]storytellerModel.ReadingRecordOutput, 0, len(rows))
	for _, row := range rows {
		publicID, ok := targets.publicIDs[row.TargetType][row.TargetID]
		if !ok {
			continue
		}
		out = append(out, storytellerModel.ReadingRecordOutput{
			TargetType:     row.TargetType,
			TargetPublicID: publicID,
			Progress:       row.Progress,
			CompletedAt:    row.CompletedAt,
			UpdatedAt:      row.UpdatedAt,
		})
	}
	return out, nil
}

func saveReadingRecords(repo readingRecordRepository, userID uint64, projectPublicID string, inputs []storytellerModel.ReadingRecordInput) ([]storytellerModel.ReadingRecordOutput, error) {
	if len(inputs) > storytellerModel.ReadingRecordMaxBatch {
		return nil, fmt.Errorf("一次最多只能寫入 %d 筆閱讀進度", storytellerModel.ReadingRecordMaxBatch)
	}
	project, targets, err := readableTargetsForReading(repo, userID, projectPublicID)
	if err != nil {
		return nil, err
	}
	// 同一批裡同一個對象出現多次時只留最大值，避免同一個 INSERT 裡撞到自己的唯一鍵
	type targetKey struct {
		kind storytellerModel.ReadingTargetType
		id   uint64
	}
	progressByTarget := make(map[targetKey]uint8, len(inputs))
	order := make([]targetKey, 0, len(inputs))
	for _, input := range inputs {
		id, ok := targets.ids[input.TargetType][strings.TrimSpace(input.TargetPublicID)]
		if !ok {
			continue
		}
		key := targetKey{kind: input.TargetType, id: id}
		progress := uint8(min(max(input.Progress, 0), 100))
		if existing, seen := progressByTarget[key]; !seen {
			order = append(order, key)
			progressByTarget[key] = progress
		} else if progress > existing {
			progressByTarget[key] = progress
		}
	}
	rows := make([]storytellerModel.ReadingRecord, 0, len(order))
	for _, key := range order {
		rows = append(rows, storytellerModel.ReadingRecord{
			UserID:     userID,
			ProjectID:  project.ID,
			TargetType: key.kind,
			TargetID:   key.id,
			Progress:   progressByTarget[key],
		})
	}
	if err := repo.UpsertReadingRecords(rows); err != nil {
		return nil, err
	}
	return readingRecords(repo, userID, projectPublicID)
}

// readingTargets 是讀者在這個專案讀得到的對象，依種類分別建 public_id ↔ id 的對照。
type readingTargets struct {
	ids       map[storytellerModel.ReadingTargetType]map[string]uint64
	publicIDs map[storytellerModel.ReadingTargetType]map[uint64]string
}

func (t readingTargets) add(kind storytellerModel.ReadingTargetType, id uint64, publicID string) {
	t.ids[kind][publicID] = id
	t.publicIDs[kind][id] = publicID
}

// readableTargetsForReading 回傳讀者在這個專案讀得到的篇章與設定：作者本人可以讀自己的草稿，
// 其他人只看得到已公開的（篇章還要所屬冊也已公開），規則跟閱讀頁一致。
func readableTargetsForReading(repo readingRecordRepository, userID uint64, projectPublicID string) (*storytellerModel.Project, readingTargets, error) {
	targets := readingTargets{ids: map[storytellerModel.ReadingTargetType]map[string]uint64{}, publicIDs: map[storytellerModel.ReadingTargetType]map[uint64]string{}}
	for _, kind := range []storytellerModel.ReadingTargetType{storytellerModel.ReadingTargetStory, storytellerModel.ReadingTargetLore} {
		targets.ids[kind] = map[string]uint64{}
		targets.publicIDs[kind] = map[uint64]string{}
	}
	project, err := repo.ProjectByPublicIDForReader(userID, projectPublicID)
	if err != nil {
		return nil, targets, err
	}
	isOwner := project.UserID == userID
	var stories []storytellerModel.Story
	if isOwner {
		stories, err = repo.Stories(project.ID)
	} else {
		stories, err = repo.PublishedStories(project.ID)
	}
	if err != nil {
		return nil, targets, err
	}
	for _, story := range stories {
		targets.add(storytellerModel.ReadingTargetStory, story.ID, story.PublicID)
	}
	lores, err := repo.ReaderLores(project.ID, isOwner)
	if err != nil {
		return nil, targets, err
	}
	for _, lore := range lores {
		targets.add(storytellerModel.ReadingTargetLore, lore.ID, lore.PublicID)
	}
	return project, targets, nil
}
