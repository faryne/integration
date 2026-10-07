package storyteller

import (
	"errors"

	"faryne.dev/middleware/authsession"
	storytellerModel "faryne.dev/model/entity/storyteller"
	"faryne.dev/repository"
	"faryne.dev/service/output"
	"faryne.dev/service/storyteller"
	notifyService "faryne.dev/service/storytellernotify"
	"github.com/gofiber/fiber/v3"
)

// customCodeNotificationLockLimit：鎖定已達上限，前端依此跳 snack 提示先解除其他鎖定。
const customCodeNotificationLockLimit output.CustomCode = "409002"

// customCodeNotificationFollowBackUnavailable：對方或我用來回追的身份已不存在。
const customCodeNotificationFollowBackUnavailable output.CustomCode = "409003"

// notifications 是讀取類 API 用的通知服務：輸出前由 storyteller service 補上追蹤者目前的筆名與回追狀態。
func notifications() *notifyService.Service {
	return notifyService.NewService().WithDecorator(storyteller.NewService().DecorateNotifications)
}

// notificationError 把找不到的通知轉成 404、鎖定上限／無法回追轉成 409，其餘當 DB 錯誤。
func notificationError(err error) error {
	switch {
	case repository.IsRecordNotFound(err):
		return output.NotFound(errors.New("notification not found"))
	case errors.Is(err, notifyService.ErrLockLimitReached):
		return output.New(fiber.StatusConflict, customCodeNotificationLockLimit, nil, "已達鎖定上限，請先解除其他通知的鎖定")
	case errors.Is(err, storyteller.ErrFollowBackUnavailable):
		return output.New(fiber.StatusConflict, customCodeNotificationFollowBackUnavailable, nil, "此身份已不存在，無法回追")
	case errors.Is(err, storyteller.ErrFollowBackIdentity):
		return output.BadRequest(errors.New("請選擇要用哪個身份回追"))
	default:
		return output.DBError(err)
	}
}

func Notifications(ctx fiber.Ctx) error {
	out, err := notifications().List(
		authsession.Session(ctx).UserId,
		storytellerModel.NotificationFilter(ctx.Query("filter")),
		ctx.Query("cursor"),
	)
	if err != nil {
		return notificationError(err)
	}
	return output.Success(out)
}

func NotificationKinds(ctx fiber.Ctx) error {
	return output.Success(notifyService.NewService().Kinds())
}

func Notification(ctx fiber.Ctx) error {
	out, err := notifications().Get(authsession.Session(ctx).UserId, ctx.Params("notification"))
	if err != nil {
		return notificationError(err)
	}
	return output.Success(out)
}

func NotificationUnreadCount(ctx fiber.Ctx) error {
	count, err := notifyService.NewService().UnreadCount(authsession.Session(ctx).UserId)
	if err != nil {
		return notificationError(err)
	}
	return output.Success(map[string]int64{"unread_count": count})
}

func ReadNotification(ctx fiber.Ctx) error {
	if err := notifyService.NewService().MarkRead(authsession.Session(ctx).UserId, ctx.Params("notification")); err != nil {
		return notificationError(err)
	}
	return output.Success(map[string]bool{"read": true})
}

func ReadAllNotifications(ctx fiber.Ctx) error {
	updated, err := notifyService.NewService().MarkAllRead(authsession.Session(ctx).UserId)
	if err != nil {
		return notificationError(err)
	}
	return output.Success(map[string]int64{"updated": updated})
}

func LockNotification(ctx fiber.Ctx) error {
	out, err := notifications().Lock(authsession.Session(ctx).UserId, ctx.Params("notification"))
	if err != nil {
		return notificationError(err)
	}
	return output.Success(out)
}

func UnlockNotification(ctx fiber.Ctx) error {
	out, err := notifications().Unlock(authsession.Session(ctx).UserId, ctx.Params("notification"))
	if err != nil {
		return notificationError(err)
	}
	return output.Success(out)
}

func DeleteNotification(ctx fiber.Ctx) error {
	if err := notifyService.NewService().Delete(authsession.Session(ctx).UserId, ctx.Params("notification")); err != nil {
		return notificationError(err)
	}
	return output.Success(map[string]bool{"deleted": true})
}

// FollowBackNotification 從追蹤／收藏通知回追；body 的 as 只在作品有多個署名身份時需要。
// 回傳更新後的通知，前端直接換掉快取裡的那一則。
func FollowBackNotification(ctx fiber.Ctx) error {
	var input struct {
		As string `json:"as"`
	}
	if err := ctx.Bind().Body(&input); err != nil {
		return output.BadRequest(err)
	}
	userID, publicID := authsession.Session(ctx).UserId, ctx.Params("notification")
	if err := storyteller.NewService().FollowBack(userID, publicID, input.As); err != nil {
		return notificationError(err)
	}
	out, err := notifications().Get(userID, publicID)
	if err != nil {
		return notificationError(err)
	}
	return output.Success(out)
}
