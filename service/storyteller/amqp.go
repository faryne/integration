package storyteller

import (
	"context"

	"faryne.dev/model/entity"
	storytellerModel "faryne.dev/model/entity/storyteller"
	"faryne.dev/model/enum"
	"faryne.dev/service/log"
	"faryne.dev/service/mq"
	"go.uber.org/zap"
)

// RegisterAMQPHandlers 註冊 SteamLoom 各訊息種類的 consumer handler；
// 由 main.go 在常駐後端啟動 consumer 之前呼叫（只能呼叫一次，重複註冊會 panic）。
func RegisterAMQPHandlers() {
	mq.Register(enum.AMQPMessageSteamLoomProjectCreated, handleProjectCreated)
}

// publishProjectCreated 在專案寫入 DB 之後才發佈，避免交易失敗卻送出事件；
// 背景發佈不拖慢建立專案的回應，佇列沒開時是 no-op。
func publishProjectCreated(project *storytellerModel.Project) {
	mq.PublishAsync(enum.AMQPQueueSteamLoom, entity.AMQPMessage[storytellerModel.ProjectCreatedMessage]{
		Type: enum.AMQPMessageSteamLoomProjectCreated,
		Payload: storytellerModel.ProjectCreatedMessage{
			ProjectPublicID: project.PublicID,
			UserID:          project.UserID,
			Name:            project.Name,
			Visibility:      project.Visibility,
		},
	})
}

// handleProjectCreated 目前只是範例：記 log 證明訊息有收到，尚無實際業務處理。
// 之後實作時要做成冪等（以 msg.ID 判斷是否處理過），因為重送／斷線都可能讓同一則訊息到兩次。
func handleProjectCreated(_ context.Context, msg entity.AMQPMessage[storytellerModel.ProjectCreatedMessage]) error {
	log.Logger().Info("SteamLoom project created event received",
		zap.String("messageId", msg.ID),
		zap.String("projectPublicId", msg.Payload.ProjectPublicID),
		zap.Uint64("userId", msg.Payload.UserID),
		zap.String("visibility", string(msg.Payload.Visibility)),
	)
	return nil
}
