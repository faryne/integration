package storyteller

import (
	"errors"

	"faryne.dev/middleware/authsession"
	storytellerModel "faryne.dev/model/entity/storyteller"
	"faryne.dev/repository"
	"faryne.dev/service/output"
	notifyService "faryne.dev/service/storytellernotify"
	"github.com/gofiber/fiber/v3"
)

// customCodeNotificationLockLimit：鎖定已達上限，前端依此跳 snack 提示先解除其他鎖定。
const customCodeNotificationLockLimit output.CustomCode = "409002"

// notificationError 把找不到的通知轉成 404、鎖定上限轉成 409，其餘當 DB 錯誤。
func notificationError(err error) error {
	switch {
	case repository.IsRecordNotFound(err):
		return output.NotFound(errors.New("notification not found"))
	case errors.Is(err, notifyService.ErrLockLimitReached):
		return output.New(fiber.StatusConflict, customCodeNotificationLockLimit, nil, "已達鎖定上限，請先解除其他通知的鎖定")
	default:
		return output.DBError(err)
	}
}

func Notifications(ctx fiber.Ctx) error {
	out, err := notifyService.NewService().List(
		authsession.Session(ctx).UserId,
		storytellerModel.NotificationFilter(ctx.Query("filter")),
		ctx.Query("cursor"),
	)
	if err != nil {
		return notificationError(err)
	}
	return output.Success(out)
}

func Notification(ctx fiber.Ctx) error {
	out, err := notifyService.NewService().Get(authsession.Session(ctx).UserId, ctx.Params("notification"))
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
	out, err := notifyService.NewService().Lock(authsession.Session(ctx).UserId, ctx.Params("notification"))
	if err != nil {
		return notificationError(err)
	}
	return output.Success(out)
}

func UnlockNotification(ctx fiber.Ctx) error {
	out, err := notifyService.NewService().Unlock(authsession.Session(ctx).UserId, ctx.Params("notification"))
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
