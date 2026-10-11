package mq

import (
	"context"
	"encoding/json"
	"errors"
	"os"
	"strconv"
	"testing"
	"time"

	"faryne.dev/model/entity"
	"faryne.dev/model/enum"
	"faryne.dev/service/client"
	"github.com/stretchr/testify/require"
)

// 需要真的 broker 才能跑；本機 `docker-compose up -d lavinmq` 後以
// AMQP_TEST_URL=amqp://guest:guest@localhost:5672/ go test ./service/mq/ 執行，沒設就略過。
func newTestQueue(t *testing.T) (Queue, string) {
	url := os.Getenv("AMQP_TEST_URL")
	if url == "" {
		t.Skip("AMQP_TEST_URL is not set")
	}
	require.NoError(t, client.InitAMQP(enum.AMQPDefault, url))
	conn := client.GetAMQP(enum.AMQPDefault)
	// 每個測試用獨立佇列名稱，避免殘留訊息互相干擾
	queue := "test." + t.Name() + "." + strconv.FormatInt(time.Now().UnixNano(), 36)
	t.Cleanup(func() {
		// 測試佇列是 durable 的，不刪會一直留在 broker 上（連到 CloudAMQP 測試時尤其要清乾淨）
		if ch, err := conn.Channel(); err == nil {
			_, _ = ch.QueueDelete(queue, false, false, false)
			_ = ch.Close()
		}
		_ = client.CloseAMQPConnections()
	})
	return NewAMQP(conn), queue
}

func TestAMQPProduceConsume(t *testing.T) {
	q, queue := newTestQueue(t)
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	require.NoError(t, q.Produce(ctx, queue, Message{ID: "m1", ContentType: "application/json", Body: []byte(`{"a":1}`)}))

	got := make(chan Message, 1)
	go func() {
		_ = q.Consume(ctx, queue, func(_ context.Context, msg Message) error {
			got <- msg
			return nil
		})
	}()
	select {
	case msg := <-got:
		require.Equal(t, "m1", msg.ID)
		require.JSONEq(t, `{"a":1}`, string(msg.Body))
		require.False(t, msg.Timestamp.IsZero())
	case <-ctx.Done():
		t.Fatal("message not consumed")
	}
}

// 第一次處理失敗要退回重送一次（Redelivered=true），重送後再失敗就丟棄、不再出現。
func TestAMQPRetryOnceThenDrop(t *testing.T) {
	q, queue := newTestQueue(t)
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	require.NoError(t, q.Produce(ctx, queue, Message{ID: "bad", Body: []byte("x")}))

	var attempts []bool
	_ = q.Consume(ctx, queue, func(_ context.Context, msg Message) error {
		attempts = append(attempts, msg.Redelivered)
		if msg.Redelivered {
			panic("boom") // panic 也要被當成失敗處理，不能讓 consumer 掛掉
		}
		return errors.New("fail")
	})
	require.Equal(t, []bool{false, true}, attempts)
}

// Publish 自動補 ID／CreatedAt；consumer 端先以 json.RawMessage 取得 Type，再解出 Payload。
func TestAMQPPublishDecode(t *testing.T) {
	q, queue := newTestQueue(t)
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	type payload struct {
		UserID uint64 `json:"user_id"`
	}
	const msgType enum.AMQPMessageType = "test.publish_decode"
	require.NoError(t, Publish(ctx, q, queue, entity.AMQPMessage[payload]{Type: msgType, Payload: payload{UserID: 42}, RequestID: "req-1"}))
	require.Error(t, Publish(ctx, q, queue, entity.AMQPMessage[payload]{Payload: payload{UserID: 1}}), "type is required")

	got := make(chan Message, 1)
	go func() {
		_ = q.Consume(ctx, queue, func(_ context.Context, msg Message) error {
			got <- msg
			return nil
		})
	}()
	select {
	case msg := <-got:
		raw, err := Decode[json.RawMessage](msg)
		require.NoError(t, err)
		require.Equal(t, msgType, raw.Type)
		require.NotEmpty(t, raw.ID)
		require.Equal(t, raw.ID, msg.ID, "envelope ID 要同步寫進 AMQP message_id")
		require.Equal(t, "req-1", raw.RequestID)
		require.False(t, raw.CreatedAt.IsZero())

		var p payload
		require.NoError(t, json.Unmarshal(raw.Payload, &p))
		require.Equal(t, uint64(42), p.UserID)
	case <-ctx.Done():
		t.Fatal("message not consumed")
	}
}
