package storytelleraudit

import (
	"context"
	"strings"

	storytellerModel "faryne.dev/model/entity/storyteller"
)

type RequestContext struct {
	RequestID     string
	Source        storytellerModel.AuditSource
	AuthMethod    storytellerModel.AuditAuthMethod
	CredentialRef string
	ActorUserID   uint64
	IP            string
	UserAgent     string
}

type requestContextKey struct{}

func WithRequestContext(ctx context.Context, value RequestContext) context.Context {
	value.UserAgent = truncateRunes(value.UserAgent, 255)
	return context.WithValue(ctx, requestContextKey{}, value)
}

func RequestContextFrom(ctx context.Context) (RequestContext, bool) {
	value, ok := ctx.Value(requestContextKey{}).(RequestContext)
	return value, ok
}

func UpdateRequestContext(ctx context.Context, update func(*RequestContext)) context.Context {
	value, _ := RequestContextFrom(ctx)
	update(&value)
	return WithRequestContext(ctx, value)
}

func IsPAT(ctx context.Context) bool {
	value, ok := RequestContextFrom(ctx)
	return ok && value.AuthMethod == storytellerModel.AuditAuthMethodPAT
}

func truncateRunes(value string, max int) string {
	value = strings.TrimSpace(value)
	if max <= 0 {
		return ""
	}
	runes := []rune(value)
	if len(runes) <= max {
		return value
	}
	return string(runes[:max])
}

func stringPointer(value string) *string {
	if value == "" {
		return nil
	}
	return &value
}
