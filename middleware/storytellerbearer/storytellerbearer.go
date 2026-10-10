package storytellerbearer

import (
	"context"
	"errors"
	"fmt"
	"strings"

	storytellerAudit "faryne.dev/middleware/storytelleraudit"
	storytellerModel "faryne.dev/model/entity/storyteller"
	"faryne.dev/service/log"
	"faryne.dev/service/output"
	storytellerService "faryne.dev/service/storyteller"
	auditService "faryne.dev/service/storytelleraudit"
	oauthService "faryne.dev/service/storytelleroauth"
	"github.com/gofiber/fiber/v3"
	"go.uber.org/zap"
)

const (
	LocalUserID     = "storyteller_bearer_user_id"
	LocalTokenLabel = "storyteller_bearer_token_label"
	LocalPublicID   = "storyteller_bearer_public_id"
)

// Credential 是 PAT 與 OAuth access token 驗證結果的共同形狀；Method 決定稽核記成哪一種憑證。
type Credential struct {
	UserID        uint64
	Label         string
	CredentialRef string
	DeniedReason  string
	Method        storytellerModel.AuditAuthMethod
}

// New 驗證 `Authorization: Bearer <token>`，供外部工具（如 MCP client）存取：
// `sto_` 開頭走 OAuth access token，其餘走 Personal Access Token。
func New() fiber.Handler {
	oauth := oauthService.NewService()
	pat := storytellerService.NewService()
	authenticate := func(token string) (*Credential, error) {
		if strings.HasPrefix(token, oauthService.AccessTokenPrefix) {
			result, err := oauth.Authenticate(token)
			credential := &Credential{Method: storytellerModel.AuditAuthMethodOAuth}
			if result != nil {
				credential.UserID, credential.Label, credential.CredentialRef, credential.DeniedReason = result.UserID, result.Label, result.CredentialRef, result.DeniedReason
			}
			return credential, err
		}
		result, err := pat.AuthenticatePersonalAccessToken(token)
		credential := &Credential{Method: storytellerModel.AuditAuthMethodPAT}
		if result != nil {
			credential.UserID, credential.Label, credential.CredentialRef, credential.DeniedReason = result.UserID, result.Label, result.CredentialRef, result.DeniedReason
		}
		return credential, err
	}
	// 站方停權的帳號：PAT／OAuth 跟 session 一樣，下一個請求就失效
	active := func(token string) (*Credential, error) {
		credential, err := authenticate(token)
		if err != nil || credential == nil {
			return credential, err
		}
		if err := pat.EnsureAccountActive(credential.UserID); err != nil {
			if errors.Is(err, storytellerService.ErrAccountSuspended) {
				credential.DeniedReason = "account_suspended"
			}
			return credential, err
		}
		return credential, nil
	}
	return newMiddleware(active, auditService.Emit, oauth.ResourceMetadataURL())
}

type authenticateFunc func(string) (*Credential, error)
type emitFunc func(context.Context, auditService.EventInput) error

func newMiddleware(authenticate authenticateFunc, emit emitFunc, resourceMetadataURL string) fiber.Handler {
	// RFC 9728：401 帶上 resource_metadata，支援 OAuth 的 MCP client 會從這裡開始授權流程
	challenge := fmt.Sprintf(`Bearer resource_metadata="%s"`, resourceMetadataURL)
	return func(ctx fiber.Ctx) error {
		token := extractBearerToken(ctx.Get(fiber.HeaderAuthorization))
		if token == "" {
			ctx.Set(fiber.HeaderWWWAuthenticate, challenge)
			return output.Unauthorized(errors.New("Authorization bearer token is required"))
		}
		credential, err := authenticate(token)
		if err != nil {
			ctx.Set(fiber.HeaderWWWAuthenticate, challenge+`, error="invalid_token"`)
			method := storytellerModel.AuditAuthMethodPAT
			if credential != nil {
				method = credential.Method
			}
			storytellerAudit.Set(ctx, func(audit *auditService.RequestContext) {
				audit.AuthMethod = method
				if credential != nil {
					audit.ActorUserID = credential.UserID
					audit.CredentialRef = credential.CredentialRef
				}
			})
			summary := auditService.FailureSummary(fiber.StatusUnauthorized, string(output.CustomCodeUnauthorized))
			if credential != nil && credential.DeniedReason != "" {
				summary["reason"] = credential.DeniedReason
			}
			if emitErr := emit(ctx.Context(), auditService.EventInput{
				Action: "auth." + string(method) + ".denied", Outcome: storytellerModel.AuditOutcomeDenied,
				Summary: summary,
			}); emitErr != nil {
				log.Logger().Error("Emit denied storyteller bearer audit event failed", zap.Error(emitErr))
			}
			return output.Unauthorized(err)
		}
		ctx.Locals(LocalUserID, credential.UserID)
		ctx.Locals(LocalTokenLabel, credential.Label)
		ctx.Locals(LocalPublicID, credential.CredentialRef)
		storytellerAudit.Set(ctx, func(audit *auditService.RequestContext) {
			audit.ActorUserID = credential.UserID
			audit.AuthMethod = credential.Method
			audit.CredentialRef = credential.CredentialRef
		})
		return ctx.Next()
	}
}

func UserID(ctx fiber.Ctx) uint64 {
	userID, _ := ctx.Locals(LocalUserID).(uint64)
	return userID
}

// TokenLabel：PAT 是使用者取的名稱，OAuth 是 client 名稱，用來在編輯歷史標記「透過誰寫入」。
func TokenLabel(ctx fiber.Ctx) string {
	label, _ := ctx.Locals(LocalTokenLabel).(string)
	return label
}

func extractBearerToken(header string) string {
	const prefix = "Bearer "
	if !strings.HasPrefix(header, prefix) {
		return ""
	}
	return strings.TrimSpace(strings.TrimPrefix(header, prefix))
}
