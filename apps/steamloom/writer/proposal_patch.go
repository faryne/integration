package main

import (
	"fmt"
	"strings"

	"faryne.dev/apps/steamloom/writer/internal/agent"
)

// applyProposalEdits 依序把 document.patch 的搜尋取代套在 base 內容上。
// 不做模糊比對：find 對不上或不唯一就回錯誤，讓 Agent 帶更多前後文重送，避免改到作者沒看到的地方。
func applyProposalEdits(content string, edits []agent.ProposalEdit) (string, error) {
	for index, edit := range edits {
		count := strings.Count(content, edit.Find)
		switch {
		case count == 0:
			return "", fmt.Errorf("edits 第 %d 筆的 find 在目前內容中找不到，請逐字複製原文（含標點與換行）", index+1)
		case count > 1 && !edit.All:
			return "", fmt.Errorf("edits 第 %d 筆的 find 出現 %d 次，請多帶前後文讓它唯一，或設定 all:true 全部取代", index+1, count)
		case edit.All:
			content = strings.ReplaceAll(content, edit.Find, edit.Replace)
		default:
			content = strings.Replace(content, edit.Find, edit.Replace, 1)
		}
	}
	return content, nil
}
