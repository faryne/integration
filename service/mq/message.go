package mq

import (
	"context"
	"crypto/rand"
	"encoding/json"
	"errors"
	"time"

	"faryne.dev/model/entity"
)

// Publish 把 AMQPMessage 序列化後送進佇列，ID／CreatedAt 沒填會自動補上；q 為 nil（佇列沒開）時直接略過。
// Go 的 interface method 不能帶型別參數，所以做成 package function 包在 Queue.Produce 外面。
func Publish[T any](ctx context.Context, q Queue, queue string, msg entity.AMQPMessage[T]) error {
	if q == nil {
		return nil
	}
	if msg.Type == "" {
		return errors.New("amqp message type is required")
	}
	if msg.ID == "" {
		msg.ID = rand.Text()
	}
	if msg.CreatedAt.IsZero() {
		msg.CreatedAt = time.Now()
	}
	body, err := json.Marshal(msg)
	if err != nil {
		return err
	}
	return q.Produce(ctx, queue, Message{ID: msg.ID, ContentType: "application/json", Body: body, Timestamp: msg.CreatedAt})
}

// Decode 把收到的訊息解回 AMQPMessage[T]。同一佇列混放多種 Type 時，先用
// Decode[json.RawMessage] 取得 Type，再對 Payload 做第二次 json.Unmarshal。
func Decode[T any](msg Message) (entity.AMQPMessage[T], error) {
	var out entity.AMQPMessage[T]
	err := json.Unmarshal(msg.Body, &out)
	return out, err
}
