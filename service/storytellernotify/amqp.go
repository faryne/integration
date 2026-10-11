package storytellernotify

import (
	"context"

	"faryne.dev/model/entity"
	"faryne.dev/model/enum"
	"faryne.dev/service/log"
	"faryne.dev/service/mq"
	"go.uber.org/zap"
)

// RegisterAMQPHandlers 註冊站內通知的 consumer handler；由 main.go 在常駐後端啟動 consumer 之前呼叫一次。
func RegisterAMQPHandlers() {
	mq.Register(enum.AMQPMessageSteamLoomNotification, NewService().handleNotification)
}

// handleNotification 把佇列中的通知寫進 DB，created_at 用事件發生時間。
// 驗證失敗屬於重送也不會好的狀況，記 log 後丟棄；寫 DB 失敗才回 error 走重送一次。
func (s *Service) handleNotification(_ context.Context, msg entity.AMQPMessage[[]Input]) error {
	rows, err := newRowsAt(msg.Payload, msg.CreatedAt)
	if err != nil {
		log.Logger().Error("Invalid storyteller notification message, dropping", zap.String("messageId", msg.ID), zap.Error(err))
		return nil
	}
	return s.repo.InsertNotifications(rows)
}
