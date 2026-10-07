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
	ReadingRecords(userID, projectID uint64) ([]storytellerModel.ReadingRecord, error)
	UpsertReadingRecords(rows []storytellerModel.ReadingRecord) error
}

// ReadingRecords 回傳讀者在這個專案的閱讀進度，只包含目前還讀得到的內容
// （已取消公開或刪除的篇章不回傳，避免列表顯示讀者點不進去的東西）。
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
	project, stories, err := readableStoriesForReading(repo, userID, projectPublicID)
	if err != nil {
		return nil, err
	}
	rows, err := repo.ReadingRecords(userID, project.ID)
	if err != nil {
		return nil, err
	}
	publicIDByID := make(map[uint64]string, len(stories))
	for _, story := range stories {
		publicIDByID[story.ID] = story.PublicID
	}
	out := make([]storytellerModel.ReadingRecordOutput, 0, len(rows))
	for _, row := range rows {
		// 設定（lore）的公開機制還沒上線，目前只輸出故事的進度
		publicID, ok := publicIDByID[row.TargetID]
		if row.TargetType != storytellerModel.ReadingTargetStory || !ok {
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
	project, stories, err := readableStoriesForReading(repo, userID, projectPublicID)
	if err != nil {
		return nil, err
	}
	idByPublicID := make(map[string]uint64, len(stories))
	for _, story := range stories {
		idByPublicID[story.PublicID] = story.ID
	}
	// 同一批裡同一篇出現多次時只留最大值，避免同一個 INSERT 裡撞到自己的唯一鍵
	progressByID := make(map[uint64]uint8, len(inputs))
	order := make([]uint64, 0, len(inputs))
	for _, input := range inputs {
		id, ok := idByPublicID[strings.TrimSpace(input.TargetPublicID)]
		if input.TargetType != storytellerModel.ReadingTargetStory || !ok {
			continue
		}
		progress := uint8(min(max(input.Progress, 0), 100))
		if existing, seen := progressByID[id]; !seen {
			order = append(order, id)
			progressByID[id] = progress
		} else if progress > existing {
			progressByID[id] = progress
		}
	}
	rows := make([]storytellerModel.ReadingRecord, 0, len(order))
	for _, id := range order {
		rows = append(rows, storytellerModel.ReadingRecord{
			UserID:     userID,
			ProjectID:  project.ID,
			TargetType: storytellerModel.ReadingTargetStory,
			TargetID:   id,
			Progress:   progressByID[id],
		})
	}
	if err := repo.UpsertReadingRecords(rows); err != nil {
		return nil, err
	}
	return readingRecords(repo, userID, projectPublicID)
}

// readableStoriesForReading 回傳讀者在這個專案讀得到的篇章：作者本人可以讀自己的草稿，
// 其他人只看得到已公開（含所屬冊也已公開）的篇章，規則跟閱讀頁一致。
func readableStoriesForReading(repo readingRecordRepository, userID uint64, projectPublicID string) (*storytellerModel.Project, []storytellerModel.Story, error) {
	project, err := repo.ProjectByPublicIDForReader(userID, projectPublicID)
	if err != nil {
		return nil, nil, err
	}
	var stories []storytellerModel.Story
	if project.UserID == userID {
		stories, err = repo.Stories(project.ID)
	} else {
		stories, err = repo.PublishedStories(project.ID)
	}
	return project, stories, err
}
