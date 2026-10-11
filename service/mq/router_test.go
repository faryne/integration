package mq

import (
	"context"
	"errors"
	"testing"

	"faryne.dev/model/entity"
	"faryne.dev/model/enum"
	"github.com/stretchr/testify/require"
)

// consumeMap 是 package 層級的全域狀態，測試用的 Type 名稱要唯一，避免跟其他測試互相干擾。
func TestDispatch(t *testing.T) {
	type payload struct {
		Name string `json:"name"`
	}
	const okType enum.AMQPMessageType = "test.router.ok"
	const failType enum.AMQPMessageType = "test.router.fail"
	var got entity.AMQPMessage[payload]
	Register(okType, func(_ context.Context, msg entity.AMQPMessage[payload]) error {
		got = msg
		return nil
	})
	Register(failType, func(context.Context, entity.AMQPMessage[payload]) error { return errors.New("boom") })

	t.Run("依 Type 分派並解出具型別的 Payload", func(t *testing.T) {
		require.NoError(t, Dispatch(context.Background(), Message{Body: []byte(`{"id":"m1","type":"test.router.ok","payload":{"name":"loom"},"request_id":"r1"}`)}))
		require.Equal(t, "m1", got.ID)
		require.Equal(t, "loom", got.Payload.Name)
		require.Equal(t, "r1", got.RequestID)
	})
	t.Run("handler 的 error 要往上傳，才會走重送一次", func(t *testing.T) {
		require.Error(t, Dispatch(context.Background(), Message{Body: []byte(`{"type":"test.router.fail","payload":{}}`)}))
	})
	t.Run("重送也不會好的狀況直接丟棄（回 nil）", func(t *testing.T) {
		got = entity.AMQPMessage[payload]{}
		for _, body := range []string{
			`not json`,
			`{"type":"test.router.unknown","payload":{}}`,
			`{"type":"test.router.ok","payload":"wrong shape"}`,
		} {
			require.NoError(t, Dispatch(context.Background(), Message{Body: []byte(body)}), body)
		}
		require.Empty(t, got.ID, "Payload 解不開時不能呼叫 handler")
	})
	t.Run("重複註冊同一種類要 panic", func(t *testing.T) {
		require.Panics(t, func() {
			Register(okType, func(context.Context, entity.AMQPMessage[payload]) error { return nil })
		})
	})
}
