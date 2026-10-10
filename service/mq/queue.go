// Package mq 定義訊息佇列的共用介面，讓通知等非同步工作不直接綁死 RabbitMQ 實作。
package mq

import (
	"context"
	"time"
)

// Message 是佇列中傳遞的一則訊息；Body 由呼叫端自行序列化（通常是 JSON）。
type Message struct {
	ID          string
	ContentType string
	Body        []byte
	Headers     map[string]any
	Timestamp   time.Time
	// Redelivered 只在 Consume 端有意義：true 代表這則訊息曾經處理失敗、被退回重送過
	Redelivered bool
}

// Handler 處理一則訊息；回傳 nil 代表處理完成（ack），回傳 error 則退回佇列重試一次，
// 重試仍失敗就丟棄，避免毒訊息無限重送。
type Handler func(ctx context.Context, msg Message) error

type Queue interface {
	// Produce 把訊息送進指定的佇列，等 broker 確認收到（publisher confirm）才返回。
	Produce(ctx context.Context, queue string, msg Message) error
	// Consume 持續消費指定佇列直到 ctx 結束；斷線時會自動重新訂閱，所以會一直阻塞，
	// 呼叫端應該放在獨立的 goroutine 執行。
	Consume(ctx context.Context, queue string, handler Handler) error
}
