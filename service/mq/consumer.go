package mq

import (
	"context"

	"faryne.dev/service/log"
	"go.uber.org/zap"
)

// Consumer 管理常駐消費的生命週期：Start 在背景跑 Queue.Consume，Stop 取消並等它結束。
// main.go 開機時 Start、關機時要在關閉 AMQP 連線之前 Stop。
type Consumer struct {
	q       Queue
	queue   string
	handler Handler
	cancel  context.CancelFunc
	done    chan struct{}
}

// NewConsumer 在 q 為 nil（沒設定 AMQP_URL）時回傳 nil；Start／Stop 對 nil 都是 no-op，
// 呼叫端不用另外判斷。
func NewConsumer(q Queue, queue string, handler Handler) *Consumer {
	if q == nil {
		return nil
	}
	return &Consumer{q: q, queue: queue, handler: handler}
}

func (c *Consumer) Start() {
	if c == nil {
		return
	}
	ctx, cancel := context.WithCancel(context.Background())
	c.cancel, c.done = cancel, make(chan struct{})
	go func() {
		defer close(c.done)
		if err := c.q.Consume(ctx, c.queue, c.handler); err != nil {
			log.Logger().Error("AMQP consumer exited", zap.String("queue", c.queue), zap.Error(err))
		}
	}()
}

// Stop 取消訂閱並等背景 goroutine 結束；處理到一半、還沒 ack 的訊息會在 channel 關閉時
// 由 broker 退回佇列，下次啟動再處理。
func (c *Consumer) Stop() {
	// done 為 nil 代表沒 Start 過，沒有 goroutine 要等
	if c == nil || c.done == nil {
		return
	}
	c.cancel()
	<-c.done
}
