package mcp

import "context"

type clientIPKey struct{}

// WithClientIP controller 把呼叫端 IP 帶進 context，需要限流的工具（女優上稿）才拿得到
func WithClientIP(ctx context.Context, ip string) context.Context {
	return context.WithValue(ctx, clientIPKey{}, ip)
}

func clientIP(ctx context.Context) string {
	ip, _ := ctx.Value(clientIPKey{}).(string)
	return ip
}
