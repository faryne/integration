package storytelleroauth

import (
	"errors"

	"faryne.dev/middleware/authsession"
	storytellerModel "faryne.dev/model/entity/storyteller"
	"faryne.dev/service/output"
	oauthService "faryne.dev/service/storytelleroauth"
	"github.com/gofiber/fiber/v3"
)

const customCodePenNameRequired output.CustomCode = "409001"

// AuthorizePreview 給授權頁在登入前顯示 client 名稱與跳轉網域，不需要 session。
func AuthorizePreview(ctx fiber.Ctx) error {
	var input storytellerModel.OAuthAuthorizeRequest
	if err := ctx.Bind().Query(&input); err != nil {
		return output.BadRequest(err)
	}
	preview, err := oauthService.NewService().Preview(input)
	if err != nil {
		return sessionError(err)
	}
	return output.Success(preview)
}

// Authorize 是使用者在授權頁按下「允許／拒絕」，回傳要跳轉的網址。
func Authorize(ctx fiber.Ctx) error {
	var input storytellerModel.OAuthAuthorizeRequest
	if err := ctx.Bind().JSON(&input); err != nil {
		return output.BadRequest(err)
	}
	result, err := oauthService.NewService().Authorize(authsession.Session(ctx).UserId, input)
	if err != nil {
		return sessionError(err)
	}
	return output.Success(result)
}

func Grants(ctx fiber.Ctx) error {
	rows, err := oauthService.NewService().Grants(authsession.Session(ctx).UserId)
	if err != nil {
		return output.DBError(err)
	}
	return output.Success(rows)
}

func RevokeGrant(ctx fiber.Ctx) error {
	row, err := oauthService.NewService().RevokeGrant(authsession.Session(ctx).UserId, ctx.Params("grant"))
	if err != nil {
		if oauthService.IsNotFound(err) {
			return output.NotFound(errors.New("oauth grant not found"))
		}
		return output.DBError(err)
	}
	return output.Success(map[string]any{"deleted": true, "public_id": row.PublicID, "client_name": row.ClientName})
}

// sessionError：沒筆名回 409 讓前端提示，其餘 OAuth 參數錯誤回 400，非預期錯誤回 500。
func sessionError(err error) error {
	if errors.Is(err, oauthService.ErrPenNameRequired) {
		return output.New(fiber.StatusConflict, customCodePenNameRequired, nil, oauthService.ErrPenNameRequired.Description)
	}
	var oauthErr *oauthService.Error
	if errors.As(err, &oauthErr) {
		return output.BadRequest(errors.New(oauthErr.Description))
	}
	return output.InternalServiceError(err)
}
