package storytelleraudit

import (
	"crypto/rand"
	"encoding/hex"
	"fmt"
	"strings"
	"sync/atomic"
	"time"

	storytellerModel "faryne.dev/model/entity/storyteller"
	auditService "faryne.dev/service/storytelleraudit"
	"github.com/gofiber/fiber/v3"
)

const LocalRequestContext = "storyteller_audit_context"

var requestIDFallback uint64

// NewRequestContext 在最外層建立 request_id 與不可變的連線資訊；驗證 middleware
// 再補 actor、auth_method 與 credential_ref，同一份 context 會一路傳到 MCP tool handler。
func NewRequestContext() fiber.Handler {
	return func(ctx fiber.Ctx) error {
		requestID := newRequestID()
		source := storytellerModel.AuditSource("")
		switch {
		case strings.HasPrefix(ctx.Path(), "/storyteller-mcp"):
			source = storytellerModel.AuditSourceMCP
		case strings.HasPrefix(ctx.Path(), "/storyteller"):
			source = storytellerModel.AuditSourceWeb
		}
		value := auditService.RequestContext{
			RequestID: requestID, Source: source, AuthMethod: storytellerModel.AuditAuthMethodNone,
			IP: ctx.IP(), UserAgent: ctx.Get(fiber.HeaderUserAgent),
		}
		ctx.Locals(LocalRequestContext, value)
		ctx.SetContext(auditService.WithRequestContext(ctx.Context(), value))
		ctx.Set("X-Request-ID", requestID)
		return ctx.Next()
	}
}

func Set(ctx fiber.Ctx, update func(*auditService.RequestContext)) {
	value, _ := auditService.RequestContextFrom(ctx.Context())
	update(&value)
	ctx.Locals(LocalRequestContext, value)
	ctx.SetContext(auditService.WithRequestContext(ctx.Context(), value))
}

func Get(ctx fiber.Ctx) (auditService.RequestContext, bool) {
	return auditService.RequestContextFrom(ctx.Context())
}

func newRequestID() string {
	var value [16]byte
	if _, err := rand.Read(value[:]); err != nil {
		return fmt.Sprintf("%d-%d", time.Now().UnixNano(), atomic.AddUint64(&requestIDFallback, 1))
	}
	return hex.EncodeToString(value[:])
}
