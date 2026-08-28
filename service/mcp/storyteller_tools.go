package mcp

import (
	"context"

	storytellerService "faryne.dev/service/storyteller"
)

func WithStorytellerUserID(ctx context.Context, userID uint64) context.Context {
	return storytellerService.WithStorytellerUserID(ctx, userID)
}

// WithStorytellerSource 帶入這次寫入要記在 story/lore version 裡的來源標記，
// 慣例是 "mcp:<token label>"，讓編輯歷史看得出是哪把 Personal Access Token 寫的。
func WithStorytellerSource(ctx context.Context, source string) context.Context {
	return storytellerService.WithStorytellerSource(ctx, source)
}

// NewStorytellerServer 建立一個只掛 storyteller CRUD 工具的獨立 server 實例，
// 不共用預設 /mcp 的 av/nekomaid 工具，也刻意不碰 AI Agent 相關功能
// （呼叫端本身就是 AI，不需要巢狀呼叫站內的 provider key）。
func NewStorytellerServer(name, version string) *Server {
	s := newBareServer(name, version)
	s.registerBuiltInTools()
	s.registerStorytellerTools()
	return s
}

func (s *Server) registerStorytellerTools() {
	for _, spec := range storytellerService.StorytellerToolRegistry().All() {
		spec := spec
		_ = s.RegisterTool(Tool{
			Name:        spec.Name,
			Description: spec.Description,
			InputSchema: spec.InputSchema,
			Handler: func(ctx context.Context, arguments map[string]interface{}) (*CallToolResult, error) {
				result, err := spec.Handler(ctx, arguments)
				if err != nil {
					return nil, err
				}
				switch v := result.(type) {
				case string:
					return textResult(v), nil
				default:
					return jsonTextResult(result)
				}
			},
		})
	}
}
