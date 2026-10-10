package mq

import (
	"context"
	"errors"
	"fmt"
	"sync"
	"time"

	"faryne.dev/service/client"
	"faryne.dev/service/log"
	amqp "github.com/rabbitmq/amqp091-go"
	"go.uber.org/zap"
)

const (
	// consumerPrefetch 限制每個 consumer 尚未 ack 的訊息數，避免一次把整個佇列拉進記憶體
	consumerPrefetch = 10
	// consumeRetryDelay 是訂閱中斷（斷線、channel 被關）後重新訂閱前的等待時間
	consumeRetryDelay = 5 * time.Second
)

// amqpQueue 是 Queue 的 AMQP 0-9-1 實作（LavinMQ／RabbitMQ 皆適用）：一律走 default exchange，routing key 即佇列名稱，
// 佇列在第一次使用時以 durable 宣告，訊息以 persistent 送出，broker 重啟也不會遺失。
type amqpQueue struct {
	conn *client.AMQP

	mu       sync.Mutex
	pubCh    *amqp.Channel       // confirm 模式的發佈專用 channel，斷線後重建
	declared map[string]struct{} // 已宣告過的佇列，避免每次發佈都多一趟 QueueDeclare
}

// NewAMQP 以既有連線建立 Queue；conn 為 nil（沒設定 AMQP_URL）時回傳 nil，
// 呼叫端據此判斷佇列功能是否開啟。
func NewAMQP(conn *client.AMQP) Queue {
	if conn == nil {
		return nil
	}
	return &amqpQueue{conn: conn, declared: make(map[string]struct{})}
}

func (q *amqpQueue) Produce(ctx context.Context, queue string, msg Message) error {
	confirm, err := q.publish(ctx, queue, msg)
	if err != nil {
		return err
	}
	// 等 confirm 不需要持有鎖，讓其他 goroutine 可以同時發佈
	acked, err := confirm.WaitContext(ctx)
	if err != nil {
		return err
	}
	if !acked {
		return fmt.Errorf("broker nacked message to queue %s", queue)
	}
	return nil
}

func (q *amqpQueue) publish(ctx context.Context, queue string, msg Message) (*amqp.DeferredConfirmation, error) {
	q.mu.Lock()
	defer q.mu.Unlock()
	if q.pubCh == nil || q.pubCh.IsClosed() {
		ch, err := q.conn.Channel()
		if err != nil {
			return nil, err
		}
		if err := ch.Confirm(false); err != nil {
			_ = ch.Close()
			return nil, err
		}
		q.pubCh = ch
	}
	if _, ok := q.declared[queue]; !ok {
		// 宣告失敗時 broker 會關掉這個 channel，下次呼叫會自動重建
		if err := declareQueue(q.pubCh, queue); err != nil {
			return nil, err
		}
		q.declared[queue] = struct{}{}
	}
	if msg.Timestamp.IsZero() {
		msg.Timestamp = time.Now()
	}
	return q.pubCh.PublishWithDeferredConfirmWithContext(ctx, "", queue, false, false, amqp.Publishing{
		MessageId:    msg.ID,
		ContentType:  msg.ContentType,
		Headers:      msg.Headers,
		Timestamp:    msg.Timestamp,
		DeliveryMode: amqp.Persistent,
		Body:         msg.Body,
	})
}

func (q *amqpQueue) Consume(ctx context.Context, queue string, handler Handler) error {
	if queue == "" || handler == nil {
		return errors.New("queue name and handler are required")
	}
	for {
		err := q.consumeOnce(ctx, queue, handler)
		if ctx.Err() != nil {
			return nil
		}
		log.Logger().Warn("AMQP consumer stopped, resubscribing", zap.String("queue", queue), zap.Error(err))
		select {
		case <-ctx.Done():
			return nil
		case <-time.After(consumeRetryDelay):
		}
	}
}

// consumeOnce 開一個 channel 訂閱佇列，直到 ctx 結束或 channel／連線斷掉才返回。
func (q *amqpQueue) consumeOnce(ctx context.Context, queue string, handler Handler) error {
	ch, err := q.conn.Channel()
	if err != nil {
		return err
	}
	defer func() { _ = ch.Close() }()
	if err := ch.Qos(consumerPrefetch, 0, false); err != nil {
		return err
	}
	if err := declareQueue(ch, queue); err != nil {
		return err
	}
	// ctx 結束時 amqp091 會自動送 basic.cancel，deliveries 隨之關閉
	deliveries, err := ch.ConsumeWithContext(ctx, queue, "", false, false, false, false, nil)
	if err != nil {
		return err
	}
	for d := range deliveries {
		if err := handleDelivery(ctx, handler, d); err != nil {
			log.Logger().Warn("Handle AMQP message failed", zap.String("queue", queue), zap.String("messageId", d.MessageId), zap.Bool("redelivered", d.Redelivered), zap.Error(err))
			// 第一次失敗退回佇列重試；已經重送過還失敗就丟棄，避免毒訊息卡死佇列
			_ = d.Nack(false, !d.Redelivered)
			continue
		}
		_ = d.Ack(false)
	}
	return errors.New("delivery channel closed")
}

// handleDelivery 呼叫 handler 並把 panic 轉成 error，避免單一壞訊息讓整個 process 掛掉。
func handleDelivery(ctx context.Context, handler Handler, d amqp.Delivery) (err error) {
	defer func() {
		if r := recover(); r != nil {
			err = fmt.Errorf("handler panic: %v", r)
		}
	}()
	return handler(ctx, Message{
		ID:          d.MessageId,
		ContentType: d.ContentType,
		Body:        d.Body,
		Headers:     d.Headers,
		Timestamp:   d.Timestamp,
		Redelivered: d.Redelivered,
	})
}

// declareQueue 以 durable、非 exclusive、不自動刪除的參數宣告佇列；重複宣告是冪等的，
// 但參數若跟 broker 上既有的佇列不同會回 PRECONDITION_FAILED。
func declareQueue(ch *amqp.Channel, queue string) error {
	_, err := ch.QueueDeclare(queue, true, false, false, false, nil)
	return err
}
