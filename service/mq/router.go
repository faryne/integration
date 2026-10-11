package mq

import (
	"context"
	"encoding/json"

	"faryne.dev/model/entity"
	"faryne.dev/model/enum"
	"faryne.dev/service/log"
	"go.uber.org/zap"
)

// rawHandler 是型別抹除後的 handler：Go 的 map 值不能各自帶不同的型別參數，
// 所以 Register[T] 把具型別的 handler 包成統一簽章，Payload 延後到分派時才解成 T。
type rawHandler func(ctx context.Context, msg entity.AMQPMessage[json.RawMessage]) error

// consumeMap 只在開機時（consumer 啟動前）由 Register 寫入，之後只讀，所以不加鎖。
var consumeMap = map[enum.AMQPMessageType]rawHandler{}

// Register 註冊某個訊息種類的 handler；同一種類重複註冊屬於程式錯誤，直接 panic 讓開機失敗。
func Register[T any](msgType enum.AMQPMessageType, handler func(ctx context.Context, msg entity.AMQPMessage[T]) error) {
	if _, ok := consumeMap[msgType]; ok {
		panic("amqp message type already registered: " + string(msgType))
	}
	consumeMap[msgType] = func(ctx context.Context, raw entity.AMQPMessage[json.RawMessage]) error {
		var payload T
		if err := json.Unmarshal(raw.Payload, &payload); err != nil {
			// Payload 跟型別對不上，重送也不會好，記 log 後直接 ack 丟棄
			log.Logger().Error("Decode AMQP payload failed, dropping", zap.String("type", string(raw.Type)), zap.String("messageId", raw.ID), zap.Error(err))
			return nil
		}
		return handler(ctx, entity.AMQPMessage[T]{ID: raw.ID, Type: raw.Type, Payload: payload, RequestID: raw.RequestID, CreatedAt: raw.CreatedAt})
	}
}

// Dispatch 是給 Queue.Consume 用的 Handler：解出 Type 後交給對應的註冊 handler。
// 外殼解不開或沒有對應 handler 都屬於重送也不會好的狀況，記 log 後丟棄；
// 只有註冊 handler 自己回傳的 error 才會走「重送一次」的流程。
func Dispatch(ctx context.Context, msg Message) error {
	raw, err := Decode[json.RawMessage](msg)
	if err != nil {
		log.Logger().Error("Decode AMQP message failed, dropping", zap.String("messageId", msg.ID), zap.Error(err))
		return nil
	}
	handler, ok := consumeMap[raw.Type]
	if !ok {
		log.Logger().Error("No AMQP handler registered, dropping", zap.String("type", string(raw.Type)), zap.String("messageId", raw.ID))
		return nil
	}
	return handler(ctx, raw)
}
