package storytelleraudit

import (
	"errors"
	"testing"
	"time"

	storytellerModel "faryne.dev/model/entity/storyteller"
	"github.com/stretchr/testify/require"
)

type fakeStreamAdder struct {
	calls int
	err   error
	order *[]string
	added []string
}

func (f *fakeStreamAdder) Add(payload string) error {
	f.calls++
	f.added = append(f.added, payload)
	if f.order != nil {
		*f.order = append(*f.order, "redis")
	}
	return f.err
}

type fakeEventStore struct {
	calls  int
	events []*storytellerModel.AuditEvent
	err    error
	order  *[]string
	insert func([]*storytellerModel.AuditEvent) error
}

func (f *fakeEventStore) InsertAuditEvents(events []*storytellerModel.AuditEvent) error {
	f.calls++
	if f.order != nil {
		*f.order = append(*f.order, "mysql")
	}
	if f.insert != nil {
		if err := f.insert(events); err != nil {
			return err
		}
	}
	f.events = append(f.events, events...)
	return f.err
}

func TestProducerFallsBackToMySQLAfterRedisRetries(t *testing.T) {
	order := make([]string, 0)
	stream, store := &fakeStreamAdder{err: errors.New("redis down"), order: &order}, &fakeEventStore{order: &order}
	producer := newProducer(stream, store)
	producer.retryDelays = []time.Duration{time.Millisecond, time.Millisecond}
	producer.sleep = func(time.Duration) {}

	require.NoError(t, producer.Emit(&storytellerModel.AuditEvent{EventID: "01K00000000000000000000000"}))
	require.Equal(t, 3, stream.calls)
	require.Equal(t, 1, store.calls)
	require.Len(t, store.events, 1)
	require.Equal(t, []string{"redis", "redis", "redis", "mysql"}, order)
}

func TestProducerLogsFullEventAfterBothLayersFail(t *testing.T) {
	stream := &fakeStreamAdder{err: errors.New("redis down")}
	store := &fakeEventStore{err: errors.New("mysql down")}
	producer := newProducer(stream, store)
	producer.retryDelays = nil
	var logged []byte
	producer.logExhausted = func(payload []byte, _ error) { logged = append([]byte(nil), payload...) }

	err := producer.Emit(&storytellerModel.AuditEvent{EventID: "01K00000000000000000000000", Action: "story.update"})
	require.Error(t, err)
	require.Contains(t, string(logged), `"event_id":"01K00000000000000000000000"`)
	require.Contains(t, string(logged), `"action":"story.update"`)
}
