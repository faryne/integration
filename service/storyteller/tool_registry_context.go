package storyteller

import (
	"context"
	"errors"
)

// storytellerMCPContextKey 用來把已通過 PAT 驗證的 userID／寫入來源標記塞進
// context，讓底下的 tool handler 可以取用；不透過 middleware 直接帶參數是因為
// ToolHandler 簽章統一只有 (ctx, arguments)，這是唯一能跨 controller 傳遞身分的管道。
type storytellerMCPContextKey struct{}
type storytellerMCPSourceContextKey struct{}

var errStorytellerMCPUnauthenticated = errors.New("missing authenticated storyteller user")

func WithStorytellerUserID(ctx context.Context, userID uint64) context.Context {
	return context.WithValue(ctx, storytellerMCPContextKey{}, userID)
}

func storytellerUserIDFromContext(ctx context.Context) (uint64, error) {
	userID, ok := ctx.Value(storytellerMCPContextKey{}).(uint64)
	if !ok || userID == 0 {
		return 0, errStorytellerMCPUnauthenticated
	}
	return userID, nil
}

// WithStorytellerSource 帶入這次寫入要記在 story/lore version 裡的來源標記，
// 慣例是 "mcp:<token label>"，讓編輯歷史看得出是哪把 Personal Access Token 寫的。
func WithStorytellerSource(ctx context.Context, source string) context.Context {
	return context.WithValue(ctx, storytellerMCPSourceContextKey{}, source)
}

func storytellerSourceFromContext(ctx context.Context) string {
	source, _ := ctx.Value(storytellerMCPSourceContextKey{}).(string)
	if source == "" {
		return "mcp"
	}
	return source
}
