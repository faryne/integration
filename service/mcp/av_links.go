package mcp

import (
	avEntity "faryne.dev/model/entity/opendata/av"
	avService "faryne.dev/service/av"
)

// joyu MCP 的搜尋結果每筆多一個 url（joyu.fyi 頁面），AI 回答時可以直接附上可點的連結。
// 用嵌入原本的結構再加欄位，JSON 會攤平成原本的欄位＋url；原本的結構沒有自訂 MarshalJSON，嵌入才不會吃掉 url

type videoRow struct {
	avEntity.CleanVideo
	URL string `json:"url"`
}

type actressRow struct {
	avEntity.Actress
	URL string `json:"url"`
}

func withVideoLinks(rows []avEntity.CleanVideo) []videoRow {
	out := make([]videoRow, len(rows))
	for i, v := range rows {
		out[i] = videoRow{CleanVideo: v, URL: avService.JoyuVideoURL(v.MakerNo, v.No)}
	}
	return out
}

func withActressLinks(rows []avEntity.Actress) []actressRow {
	out := make([]actressRow, len(rows))
	for i, a := range rows {
		out[i] = actressRow{Actress: a, URL: avService.JoyuActressURL(a.Name, a.Domain, a.AID)}
	}
	return out
}
