package storyteller

import (
	"fmt"
	"regexp"
)

// loreURIRegexp 比對內文裡的設定連結 steamloom-lore://<lorePublicID>。
// 設定連結就是一般的連結 marker：⟦a-<id> href="steamloom-lore://<lorePublicID>"⟧文字⟦/a-<id>⟧；
// 圖像作品的頁面說明存在 JSON 裡，一樣直接掃原始字串就好（public_id 不會含引號）。
var loreURIRegexp = regexp.MustCompile(`steamloom-lore://([A-Za-z0-9._~-]+)`)

func lorePublicIDsFromContent(content string) []string {
	matches := loreURIRegexp.FindAllStringSubmatch(content, -1)
	ids := make([]string, 0, len(matches))
	for _, match := range matches {
		ids = append(ids, match[1])
	}
	return uniqueStrings(ids)
}

// validateLoreReferences 確認內文引用的設定都在同一個專案裡；不檢查是否已公開——作者可以先寫連結、
// 之後才公開那則設定，讀者端遇到未公開的設定只會顯示純文字。
// 回復舊版本（RevertStory／RevertLore）刻意不呼叫：舊版本可能連到後來刪掉的設定，讀者端一樣顯示純文字，
// 不該因此擋住回復。
func (s *Service) validateLoreReferences(projectID uint64, content string) error {
	ids := lorePublicIDsFromContent(content)
	if len(ids) == 0 {
		return nil
	}
	rows, err := s.repo.LoresByPublicIDs(projectID, ids)
	if err != nil {
		return err
	}
	found := make(map[string]bool, len(rows))
	for _, row := range rows {
		found[row.PublicID] = true
	}
	for _, id := range ids {
		if !found[id] {
			return fmt.Errorf("lore not found in this project: %s", id)
		}
	}
	return nil
}

// validateContentReferences 一次檢查內文裡的資產與設定連結
func (s *Service) validateContentReferences(projectID uint64, content string) error {
	if err := s.validateMarkdownAssetReferences(projectID, content); err != nil {
		return err
	}
	return s.validateLoreReferences(projectID, content)
}
