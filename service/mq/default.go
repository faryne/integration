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

// PublishAsync 在背景把訊息送進預設佇列，不阻塞呼叫端（例如 HTTP request）。
// 送不出去（broker 掛掉、confirm 逾時、程序已進入 drain 不再接背景工作）時呼叫 onFail，
// 讓呼叫端決定要不要改走備援（例如直接寫 DB）；onFail 為 nil 則只記 log。
// goroutine 會掛在 background tracker 上，優雅重啟時會等它送完。
func PublishAsync[T any](queue string, msg entity.AMQPMessage[T], onFail func(error)) {
	if defaultQueue == nil {
		return
	}
	fail := func(err error) {
		log.Logger().Warn("Publish AMQP message failed", zap.String("queue", queue), zap.String("type", string(msg.Type)), zap.Error(err))
		if onFail != nil {
			onFail(err)
		}
	}
	finish, err := background.Track("amqp publish " + string(msg.Type))
	if err != nil {
		fail(err)
		return
	}
	go func() {
		defer finish()
		ctx, cancel := context.WithTimeout(background.Context(), asyncPublishTimeout)
		defer cancel()
		if err := Publish(ctx, defaultQueue, queue, msg); err != nil {
			fail(err)
		}
	}()
}
