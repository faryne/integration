package entity

import (
	"time"

	"faryne.dev/model/enum"
)

// AMQPMessage 是佇列訊息的統一外殼，序列化成 JSON 放進 mq.Message.Body。
// 同一個佇列可以混放多種 Type：consumer 先以 AMQPMessage[json.RawMessage] 解出 Type，
// 再把 Payload 解成對應的型別。
type AMQPMessage[T any] struct {
	// ID 由 mq.Publish 自動產生，同時寫進 AMQP 的 message_id；consumer 用它做冪等判斷，
	// 因為重送、斷線重連都可能讓同一則訊息被處理兩次
	ID      string               `json:"id"`
	Type    enum.AMQPMessageType `json:"type"`
	Payload T                    `json:"payload"`
	// RequestID 是觸發這則訊息的 HTTP request_id（有的話），讓 consumer 的 log 能對回原始請求
	RequestID string    `json:"request_id,omitempty"`
	CreatedAt time.Time `json:"created_at"`
}
