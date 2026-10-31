package opendata

import (
	"errors"
	"net/http"
	"strconv"

	"github.com/gofiber/fiber/v3"

	"faryne.dev/controller/helper"
	"faryne.dev/middleware/authsession"
	avEntity "faryne.dev/model/entity/opendata/av"
	authService "faryne.dev/service/auth"
	"faryne.dev/service/av"
	"faryne.dev/service/output"
)

// AdminActressTopics 自訂女優主題列表（含停用）
func AdminActressTopics(ctx fiber.Ctx) error {
	items, err := av.ListActressTopics(authsession.Session(ctx).UserId)
	if err != nil {
		return actressTopicError(err)
	}
	return output.Success(items)
}

// AdminActressTopic 單一自訂主題（編輯頁）
func AdminActressTopic(ctx fiber.Ctx) error {
	item, err := av.GetActressTopic(authsession.Session(ctx).UserId, topicIDParam(ctx))
	if err != nil {
		return actressTopicError(err)
	}
	return output.Success(item)
}

// AdminCreateActressTopic 新增自訂主題；下一次每週排程才會產生
func AdminCreateActressTopic(ctx fiber.Ctx) error {
	return saveActressTopic(ctx, 0)
}

// AdminUpdateActressTopic 修改自訂主題；下一次每週排程才會反映
func AdminUpdateActressTopic(ctx fiber.Ctx) error {
	return saveActressTopic(ctx, topicIDParam(ctx))
}

func saveActressTopic(ctx fiber.Ctx, id uint64) error {
	var req avEntity.ActressTopicSaveRequest
	if err := helper.BindJSON(ctx, &req); err != nil {
		return err
	}
	item, err := av.SaveActressTopic(authsession.Session(ctx).UserId, id, req)
	if err != nil {
		return actressTopicError(err)
	}
	return output.Success(item)
}

// AdminSetActressTopicEnabled 啟用／停用
func AdminSetActressTopicEnabled(ctx fiber.Ctx) error {
	var req avEntity.ActressTopicEnabledRequest
	if err := helper.BindJSON(ctx, &req); err != nil {
		return err
	}
	if err := av.SetActressTopicEnabled(authsession.Session(ctx).UserId, topicIDParam(ctx), req.Enabled); err != nil {
		return actressTopicError(err)
	}
	return output.Success(nil)
}

// AdminSortActressTopics 調整總覽頁的順序
func AdminSortActressTopics(ctx fiber.Ctx) error {
	var req avEntity.ActressTopicSortRequest
	if err := helper.BindJSON(ctx, &req); err != nil {
		return err
	}
	if err := av.SortActressTopics(authsession.Session(ctx).UserId, req.IDs); err != nil {
		return actressTopicError(err)
	}
	return output.Success(nil)
}

// AdminDeleteActressTopic 軟刪除；下一次排程從總覽頁拿掉
func AdminDeleteActressTopic(ctx fiber.Ctx) error {
	if err := av.DeleteActressTopic(authsession.Session(ctx).UserId, topicIDParam(ctx)); err != nil {
		return actressTopicError(err)
	}
	return output.Success(nil)
}

// AdminActressTopicOptions 編輯頁自動完成的選項（出身地、類型）
func AdminActressTopicOptions(ctx fiber.Ctx) error {
	options, err := av.ActressTopicOptionsFor(ctx.Context(), authsession.Session(ctx).UserId)
	if err != nil {
		return actressTopicError(err)
	}
	return output.Success(options)
}

func topicIDParam(ctx fiber.Ctx) uint64 {
	id, _ := strconv.ParseUint(ctx.Params("id"), 10, 64)
	return id
}

// actressTopicError 權限與驗證錯誤自己處理（訊息是給管理員看的中文），其他交給 FromError（查無資料 404）
func actressTopicError(err error) error {
	switch {
	case errors.Is(err, authService.ErrAdminRequired):
		return output.New(http.StatusForbidden, "", nil, "需要管理者權限")
	case errors.Is(err, av.ErrActressTopicInvalid):
		return output.New(http.StatusBadRequest, "", nil, err.Error())
	}
	return output.FromError(err)
}
