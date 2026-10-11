package mq

import (
	"context"
	"time"

	"faryne.dev/model/entity"
	"faryne.dev/service/background"
	"faryne.dev/service/log"
	"go.uber.org/zap"
)

// asyncPublishTimeout 是背景發佈等 broker confirm 的上限，避免 broker 卡住時 goroutine 一直累積
const asyncPublishTimeout = 10 * time.Second

// defaultQueue 由 main.go 開機時注入（-cmd 與常駐後端共用），讓 service 不用一路傳遞 Queue；
// 沒設定 AMQP_URL 時為 nil，所有發佈都會變成 no-op。
var defaultQueue Queue

func SetDefault(q Queue) { defaultQueue = q }

func Default() Queue { return defaultQueue }

// PublishAsync 在背景把訊息送進預設佇列，不阻塞呼叫端（例如 HTTP request）；
// 失敗只記 log，適合通知這類非關鍵事件。goroutine 會掛在 background tracker 上，
// 優雅重啟時會等它送完；已進入 drain 階段則放棄發佈。
func PublishAsync[T any](queue string, msg entity.AMQPMessage[T]) {
	if defaultQueue == nil {
		return
	}
	finish, err := background.Track("amqp publish " + string(msg.Type))
	if err != nil {
		log.Logger().Warn("Skip AMQP publish while draining", zap.String("queue", queue), zap.String("type", string(msg.Type)))
		return
	}
	go func() {
		defer finish()
		ctx, cancel := context.WithTimeout(background.Context(), asyncPublishTimeout)
		defer cancel()
		if err := Publish(ctx, defaultQueue, queue, msg); err != nil {
			log.Logger().Warn("Publish AMQP message failed", zap.String("queue", queue), zap.String("type", string(msg.Type)), zap.Error(err))
		}
	}()
}
