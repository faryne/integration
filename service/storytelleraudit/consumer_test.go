package storytelleraudit

import (
	"errors"
	"testing"
	"time"

	storytellerModel "faryne.dev/model/entity/storyteller"
	"faryne.dev/service/background"
	"github.com/stretchr/testify/require"
)

type fakeConsumerStream struct {
	acked   []string
	deleted []string
	dead    []streamMessage
}

func (f *fakeConsumerStream) CreateGroup() error { return nil }
func (f *fakeConsumerStream) ReadNew(string, int64, time.Duration) ([]streamMessage, error) {
	return nil, nil
}
func (f *fakeConsumerStream) ClaimRetryable(string, int64) ([]streamMessage, error) { return nil, nil }
func (f *fakeConsumerStream) AckAndDelete(ids ...string) error {
	f.acked = append(f.acked, ids...)
	f.deleted = append(f.deleted, ids...)
	return nil
}
func (f *fakeConsumerStream) DeadLetter(message streamMessage) error {
	f.dead = append(f.dead, message)
	return f.AckAndDelete(message.ID)
}

func TestConsumerWritesAndAcknowledgesBatch(t *testing.T) {
	stream, store := &fakeConsumerStream{}, &fakeEventStore{}
	consumer := newConsumer(stream, store, background.NewTracker())
	consumer.processBatch([]streamMessage{{ID: "1-0", Deliveries: 1, Payload: `{"event_id":"01K00000000000000000000000","action":"story.update"}`}})
	require.Equal(t, []string{"1-0"}, stream.acked)
	require.Equal(t, []string{"1-0"}, stream.deleted)
	require.Len(t, store.events, 1)
}

func TestConsumerLeavesBatchPendingWhenMySQLFails(t *testing.T) {
	stream, store := &fakeConsumerStream{}, &fakeEventStore{err: errors.New("mysql down")}
	consumer := newConsumer(stream, store, background.NewTracker())
	consumer.processBatch([]streamMessage{{ID: "1-0", Deliveries: 2, Payload: `{"event_id":"01K00000000000000000000000","action":"story.update"}`}})
	require.Empty(t, stream.acked)
	require.Empty(t, stream.deleted)
	require.Empty(t, stream.dead)
}

func TestConsumerDeadLettersAfterMaximumDeliveries(t *testing.T) {
	stream, store := &fakeConsumerStream{}, &fakeEventStore{}
	consumer := newConsumer(stream, store, background.NewTracker())
	message := streamMessage{ID: "1-0", Deliveries: maxDeliveryAttempts, Payload: `{"event_id":"01K00000000000000000000000"}`}
	consumer.processBatch([]streamMessage{message})
	require.Equal(t, []streamMessage{message}, stream.dead)
	require.Equal(t, []string{"1-0"}, stream.acked)
	require.Equal(t, []string{"1-0"}, stream.deleted)
	require.Empty(t, store.events)
	require.True(t, shouldDeadLetter(maxDeliveryAttempts))
	require.False(t, shouldDeadLetter(maxDeliveryAttempts-1))
}

func TestConsumerIsolatesFailedEventAfterBatchInsertFailure(t *testing.T) {
	stream := &fakeConsumerStream{}
	store := &fakeEventStore{insert: func(events []*storytellerModel.AuditEvent) error {
		if len(events) > 1 || events[0].EventID == "01K00000000000000000000002" {
			return errors.New("poison event")
		}
		return nil
	}}
	consumer := newConsumer(stream, store, background.NewTracker())
	consumer.processBatch([]streamMessage{
		{ID: "1-0", Deliveries: 1, Payload: `{"event_id":"01K00000000000000000000001","action":"story.update"}`},
		{ID: "2-0", Deliveries: 1, Payload: `{"event_id":"01K00000000000000000000002","action":"story.update"}`},
	})

	require.Equal(t, []string{"1-0"}, stream.acked)
	require.Equal(t, []string{"1-0"}, stream.deleted)
	require.Empty(t, stream.dead)
	require.Equal(t, 3, store.calls)
}
