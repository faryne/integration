package mcp

// NewJoyuServer joyu.fyi（AV 女優資料站）專屬的 MCP server：只掛 AV 工具（搜尋、上稿、查審核結果）。
// AV 跟 faryne.dev 刻意切割（見 DevelopDocuments/opendata/joyu.fyi獨立站_2026-11-08.md），
// 所以這些工具從預設 /mcp 拿掉，改由 https://joyu.fyi/mcp 提供（nginx 改寫成後端 /joyu-mcp）。
func NewJoyuServer(name, version string) *Server {
	s := newBareServer(name, version)
	// 給 connector 列表顯示用（MCP 2025-11-25 的 title／websiteUrl／icons），同 NewStorytellerServer
	s.identity = map[string]any{
		"title":      "joyu.fyi",
		"websiteUrl": "https://joyu.fyi",
		"icons": []map[string]any{
			{"src": "https://joyu.fyi/joyu-icon-256.png", "mimeType": "image/png", "sizes": []string{"256x256"}},
		},
	}
	s.registerBuiltInTools()
	s.registerAVTools()
	s.registerAVActressSubmissionTools()
	s.registerAVVideoSubmissionTools()
	return s
}
