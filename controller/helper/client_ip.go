package helper

import (
	"net"
	"strings"

	"github.com/gofiber/fiber/v3"
)

// ClientIP 取用戶端 IP：優先用 nginx 帶的 X-Real-IP（fiber 的 ProxyHeader）；
// 沒有這個 header 時（例如本機直接打 API），ctx.IP() 會是空字串，改用 TCP 連線的來源位址，
// 避免記錄、限流、IP 雜湊拿到空值（所有人共用同一個額度與 hash）。
func ClientIP(ctx fiber.Ctx) string {
	return clientIP(ctx.IP(), ctx.RequestCtx().RemoteIP())
}

func clientIP(proxyIP string, remoteIP net.IP) string {
	if proxyIP = strings.TrimSpace(proxyIP); proxyIP != "" {
		return proxyIP
	}
	if remoteIP == nil {
		return ""
	}
	return remoteIP.String()
}
