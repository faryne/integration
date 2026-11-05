package nekomaid

import (
	"context"
	"errors"
	"time"

	"faryne.dev/controller/helper"
	"faryne.dev/middleware/authsession"
	nekomaidEntity "faryne.dev/model/entity/nekomaid"
	"faryne.dev/service/nekomaid/account"
	"faryne.dev/service/nekomaid/firebaseauth"
	"faryne.dev/service/output"
	"github.com/gofiber/fiber/v3"
)

// 呼叫 Firebase REST 的逾時（後端可能一次打兩三支 API）
const accountRequestTimeout = 20 * time.Second

// AccountLogin 登入（帳號或 email＋密碼）；舊會員第一次登入時順便搬進 Firebase
func AccountLogin(ctx fiber.Ctx) error {
	var input nekomaidEntity.LoginRequest
	if err := helper.BindJSON(ctx, &input); err != nil {
		return err
	}
	requestCtx, cancel := context.WithTimeout(context.Background(), accountRequestTimeout)
	defer cancel()
	resp, err := account.Login(requestCtx, input, helper.ClientIP(ctx))
	if err != nil {
		return accountError(err)
	}
	return output.Success(resp)
}

// AccountRegister 註冊新帳號
func AccountRegister(ctx fiber.Ctx) error {
	var input nekomaidEntity.RegisterRequest
	if err := helper.BindJSON(ctx, &input); err != nil {
		return err
	}
	requestCtx, cancel := context.WithTimeout(context.Background(), accountRequestTimeout)
	defer cancel()
	resp, err := account.Register(requestCtx, input, helper.ClientIP(ctx))
	if err != nil {
		return accountError(err)
	}
	return output.Success(resp)
}

// AccountPasswordReset 忘記密碼；不論 email 存不存在都回成功
func AccountPasswordReset(ctx fiber.Ctx) error {
	var input nekomaidEntity.PasswordResetRequest
	if err := helper.BindJSON(ctx, &input); err != nil {
		return err
	}
	requestCtx, cancel := context.WithTimeout(context.Background(), accountRequestTimeout)
	defer cancel()
	if err := account.PasswordReset(requestCtx, input, helper.ClientIP(ctx)); err != nil {
		return accountError(err)
	}
	return output.Success(nil)
}

// AccountAction 信件連結（驗證 email、重設密碼）
func AccountAction(ctx fiber.Ctx) error {
	var input nekomaidEntity.AuthActionRequest
	if err := helper.BindJSON(ctx, &input); err != nil {
		return err
	}
	requestCtx, cancel := context.WithTimeout(context.Background(), accountRequestTimeout)
	defer cancel()
	result, err := account.HandleAction(requestCtx, input)
	if err != nil {
		return accountError(err)
	}
	return output.Success(result)
}

// AccountCurrent 目前登入者（頁首、未驗證提示條用）；同時讓 session 的 sliding TTL 續期
func AccountCurrent(ctx fiber.Ctx) error {
	resp, err := account.Current(authsession.Session(ctx).UserId)
	if err != nil {
		return output.FromError(err)
	}
	return output.Success(resp)
}

// AccountDevSession 本機自動化測試用的假登入（只在 ENABLE_DEV_AUTH_BYPASS 時註冊）
func AccountDevSession(ctx fiber.Ctx) error {
	resp, err := account.CreateDevSession()
	if err != nil {
		return output.BadRequest(err)
	}
	return output.Success(resp)
}

// accountError 帳號流程的預期錯誤帶 reason 給前端判斷要顯示哪個欄位；Firebase 沒設定回 500
func accountError(err error) error {
	var accountErr *account.Error
	switch {
	case errors.As(err, &accountErr):
		data := map[string]string{"reason": accountErr.Reason}
		if accountErr.MergedInto != "" {
			data["merged_into"] = accountErr.MergedInto
		}
		return output.New(accountErr.Status, "", data, accountErr.Message)
	case errors.Is(err, firebaseauth.ErrNotConfigured):
		return output.InternalServiceError(err)
	}
	return output.FromError(err)
}

// AccountChangeEmail 改版前的舊帳號在整合前修改 email（驗證信寄到新信箱，點了才換）
func AccountChangeEmail(ctx fiber.Ctx) error {
	var input nekomaidEntity.ChangeEmailRequest
	if err := helper.BindJSON(ctx, &input); err != nil {
		return err
	}
	requestCtx, cancel := context.WithTimeout(context.Background(), accountRequestTimeout)
	defer cancel()
	if err := account.ChangeEmail(requestCtx, authsession.Session(ctx).UserId, input); err != nil {
		return accountError(err)
	}
	return output.Success(nil)
}
