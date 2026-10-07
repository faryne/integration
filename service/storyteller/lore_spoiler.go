package storyteller

import (
	"fmt"
	"strings"

	storytellerModel "faryne.dev/model/entity/storyteller"
)

// loreTarget 是依賴對象在對照表裡的資料
type loreTarget struct {
	id       uint64
	publicID string
	title    string
}

// loreTargetDirectory 是專案內故事與設定的對照表，依種類分別用 public_id 與 id 查詢
type loreTargetDirectory struct {
	byPublicID map[storytellerModel.ReadingTargetType]map[string]loreTarget
	byID       map[storytellerModel.ReadingTargetType]map[uint64]loreTarget
}

func newLoreTargetDirectory(stories []storytellerModel.Story, lores []storytellerModel.Lore) loreTargetDirectory {
	dir := loreTargetDirectory{
		byPublicID: map[storytellerModel.ReadingTargetType]map[string]loreTarget{},
		byID:       map[storytellerModel.ReadingTargetType]map[uint64]loreTarget{},
	}
	add := func(kind storytellerModel.ReadingTargetType, target loreTarget) {
		if dir.byPublicID[kind] == nil {
			dir.byPublicID[kind], dir.byID[kind] = map[string]loreTarget{}, map[uint64]loreTarget{}
		}
		dir.byPublicID[kind][target.publicID] = target
		dir.byID[kind][target.id] = target
	}
	for _, story := range stories {
		if !story.IsVolume {
			add(storytellerModel.ReadingTargetStory, loreTarget{id: story.ID, publicID: story.PublicID, title: story.Title})
		}
	}
	for _, lore := range lores {
		add(storytellerModel.ReadingTargetLore, loreTarget{id: lore.ID, publicID: lore.PublicID, title: lore.Title})
	}
	return dir
}

// resolveLoreDependencies 把作者送來的依賴轉成資料列：對象必須在同一個專案（不分公開狀態，
// 作者可以先設依賴、之後再公開那篇），不能指向自己，重複的只留第一筆
func resolveLoreDependencies(dir loreTargetDirectory, selfLoreID uint64, refs []storytellerModel.LoreDependencyRef) ([]storytellerModel.LoreDependency, error) {
	rows := make([]storytellerModel.LoreDependency, 0, len(refs))
	seen := map[string]bool{}
	for _, ref := range refs {
		publicID := strings.TrimSpace(ref.TargetPublicID)
		target, ok := dir.byPublicID[ref.TargetType][publicID]
		if !ok {
			return nil, fmt.Errorf("找不到依賴對象：%s %s", ref.TargetType, publicID)
		}
		if ref.TargetType == storytellerModel.ReadingTargetLore && target.id == selfLoreID {
			return nil, fmt.Errorf("設定不能依賴自己")
		}
		key := string(ref.TargetType) + ":" + publicID
		if seen[key] {
			continue
		}
		seen[key] = true
		rows = append(rows, storytellerModel.LoreDependency{TargetType: ref.TargetType, TargetID: target.id, Sort: len(rows)})
	}
	if len(rows) > storytellerModel.LoreDependencyMax {
		return nil, fmt.Errorf("依賴最多 %d 筆", storytellerModel.LoreDependencyMax)
	}
	return rows, nil
}

// fillLoreDependencies 把依賴補到設定上；對照表裡查不到的對象（讀者讀不到的、已刪除的）直接略過，
// 公開閱讀頁因此不會洩漏未公開內容的標題，讀者端也會把它視為已滿足
func fillLoreDependencies(lores []storytellerModel.Lore, rows []storytellerModel.LoreDependency, dir loreTargetDirectory) {
	byLore := map[uint64][]storytellerModel.LoreDependencyRef{}
	for _, row := range rows {
		target, ok := dir.byID[row.TargetType][row.TargetID]
		if !ok {
			continue
		}
		byLore[row.LoreID] = append(byLore[row.LoreID], storytellerModel.LoreDependencyRef{
			TargetType: row.TargetType, TargetPublicID: target.publicID, Title: target.title,
		})
	}
	for i := range lores {
		lores[i].DependsOn = byLore[lores[i].ID]
	}
}

// authorLoreTargetDirectory 是作者端用的完整對照表（含草稿）
func (s *Service) authorLoreTargetDirectory(projectID uint64) (loreTargetDirectory, error) {
	stories, lores, err := s.repo.ProjectTargetTitles(projectID)
	if err != nil {
		return loreTargetDirectory{}, err
	}
	return newLoreTargetDirectory(stories, lores), nil
}

// prepareLoreDependencies 在存檔前驗證依賴；回傳 nil 代表這次沒帶依賴（不變更）
func (s *Service) prepareLoreDependencies(projectID, selfLoreID uint64, input storytellerModel.LoreRequest) ([]storytellerModel.LoreDependency, error) {
	if input.DependsOn == nil {
		return nil, nil
	}
	dir, err := s.authorLoreTargetDirectory(projectID)
	if err != nil {
		return nil, err
	}
	return resolveLoreDependencies(dir, selfLoreID, *input.DependsOn)
}

// saveAndFillLoreDependencies 存檔後寫入依賴（rows 為 nil 代表不變更），再把目前的依賴補回輸出
func (s *Service) saveAndFillLoreDependencies(projectID uint64, lore *storytellerModel.Lore, rows []storytellerModel.LoreDependency) error {
	if rows != nil {
		for i := range rows {
			rows[i].LoreID = lore.ID
		}
		if err := s.repo.ReplaceLoreDependencies(lore.ID, rows); err != nil {
			return err
		}
	}
	one := []storytellerModel.Lore{*lore}
	if err := s.fillAuthorLoreDependencies(projectID, one); err != nil {
		return err
	}
	lore.DependsOn = one[0].DependsOn
	return nil
}

// fillAuthorLoreDependencies 用作者端對照表原地補上依賴（含草稿對象的標題）
func (s *Service) fillAuthorLoreDependencies(projectID uint64, lores []storytellerModel.Lore) error {
	ids := make([]uint64, 0, len(lores))
	for _, lore := range lores {
		ids = append(ids, lore.ID)
	}
	rows, err := s.repo.LoreDependencies(ids)
	if err != nil {
		return err
	}
	dir, err := s.authorLoreTargetDirectory(projectID)
	if err != nil {
		return err
	}
	fillLoreDependencies(lores, rows, dir)
	return nil
}
