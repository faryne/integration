// Package storytelleroauth 的公開端點（well-known、register、token、revoke）是給 OAuth client
// 呼叫的，回應格式必須照 RFC，所以刻意不用 service/output 的標準包裝；
// 授權頁與「開發者 › OAuth Token」頁用的 session API 才走標準包裝（見 session.go）。
package storytelleroauth

import (
	"errors"

	storytellerAudit "faryne.dev/middleware/storytelleraudit"
	storytellerModel "faryne.dev/model/entity/storyteller"
	"faryne.dev/service/log"
	auditService "faryne.dev/service/storytelleraudit"
	oauthService "faryne.dev/service/storytelleroauth"
	"github.com/gofiber/fiber/v3"
	"go.uber.org/zap"
)

func ProtectedResourceMetadata(ctx fiber.Ctx) error {
	return ctx.JSON(oauthService.NewService().ProtectedResourceMetadata())
}

func AuthorizationServerMetadata(ctx fiber.Ctx) error {
	return ctx.JSON(oauthService.NewService().AuthorizationServerMetadata())
}

// Register 是 RFC 7591 Dynamic Client Registration。
func Register(ctx fiber.Ctx) error {
	var input storytellerModel.OAuthClientRegistrationRequest
	if err := ctx.Bind().JSON(&input); err != nil {
		return writeError(ctx, &oauthService.Error{Status: fiber.StatusBadRequest, Code: "invalid_client_metadata", Description: "request body 必須是 JSON"})
	}
	output, err := oauthService.NewService().Register(ctx.IP(), input)
	if err != nil {
		return writeError(ctx, err)
	}
	return ctx.Status(fiber.StatusCreated).JSON(output)
}

// Token 處理 authorization_code 與 refresh_token 兩種 grant；token 回應不得被快取（RFC 6749 5.1）。
func Token(ctx fiber.Ctx) error {
	ctx.Set(fiber.HeaderCacheControl, "no-store")
	ctx.Set(fiber.HeaderPragma, "no-cache")
	result, err := oauthService.NewService().Token(oauthService.TokenRequest{
		GrantType:    ctx.FormValue("grant_type"),
		Code:         ctx.FormValue("code"),
		RedirectURI:  ctx.FormValue("redirect_uri"),
		ClientID:     ctx.FormValue("client_id"),
		CodeVerifier: ctx.FormValue("code_verifier"),
		RefreshToken: ctx.FormValue("refresh_token"),
		Resource:     ctx.FormValue("resource"),
	})
	if err != nil {
		return writeError(ctx, err)
	}
	if result.Grant != nil {
		emitGrantEvent(ctx, "oauth.grant.create", result.Grant, nil)
	}
	return ctx.JSON(result.Output)
}

// Revoke 是 RFC 7009：不論 token 存不存在都回 200。
func Revoke(ctx fiber.Ctx) error {
	grant, err := oauthService.NewService().Revoke(ctx.FormValue("token"))
	if err != nil {
		return writeError(ctx, err)
	}
	if grant != nil {
		// 跟「開發者 › OAuth Token」頁的撤銷同一個 action，用 revoked_by 區分是誰撤銷的
		emitGrantEvent(ctx, "oauth.revoke", grant, storytellerModel.AuditSummary{"revoked_by": "client"})
	}
	return ctx.SendStatus(fiber.StatusOK)
}

// emitGrantEvent 補記 token 端點的稽核：這裡沒有 session，actor 與憑證取自 grant 本身，
// credential_ref 用 grant public_id，之後這個授權的 MCP 呼叫就能跟這筆事件對起來。
func emitGrantEvent(ctx fiber.Ctx, action string, grant *oauthService.GrantEvent, extra storytellerModel.AuditSummary) {
	storytellerAudit.Set(ctx, func(audit *auditService.RequestContext) {
		audit.ActorUserID = grant.UserID
		audit.AuthMethod = storytellerModel.AuditAuthMethodOAuth
		audit.CredentialRef = grant.PublicID
	})
	summary := storytellerModel.AuditSummary{"client_id": grant.ClientID, "client_name": grant.ClientName}
	for key, value := range extra {
		summary[key] = value
	}
	if err := auditService.Emit(ctx.Context(), auditService.EventInput{
		Action: action, TargetType: "oauth_grant", TargetPublicID: grant.PublicID, Summary: summary,
	}); err != nil {
		log.Logger().Error("Emit storyteller OAuth audit event failed", zap.String("action", action), zap.Error(err))
	}
}

// writeError 輸出 RFC 格式的 {error, error_description}；非預期錯誤只回 server_error，細節寫 log。
func writeError(ctx fiber.Ctx, err error) error {
	var oauthErr *oauthService.Error
	if errors.As(err, &oauthErr) {
		return ctx.Status(oauthErr.Status).JSON(fiber.Map{"error": oauthErr.Code, "error_description": oauthErr.Description})
	}
	log.Logger().Error("Storyteller OAuth endpoint failed", zap.String("path", ctx.Path()), zap.Error(err))
	return ctx.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "server_error"})
}
