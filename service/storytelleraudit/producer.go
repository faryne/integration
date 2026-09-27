package storytelleraudit

import (
	"context"
	"encoding/json"
	"errors"
	"sync"
	"time"

	storytellerModel "faryne.dev/model/entity/storyteller"
	storytellerRepo "faryne.dev/repository/storyteller"
	"faryne.dev/service/log"
	"github.com/go-redis/redis/v7"
	"go.uber.org/zap"
)

const (
	StreamName     = "storyteller:audit:events"
	DeadStreamName = "storyteller:audit:events:dead"
	streamField    = "event"
)

type streamAdder interface {
	Add(payload string) error
}

type eventStore interface {
	InsertAuditEvents(events []*storytellerModel.AuditEvent) error
}

type Producer struct {
	stream       streamAdder
	store        eventStore
	retryDelays  []time.Duration
	sleep        func(time.Duration)
	logExhausted func([]byte, error)
}

type redisStreamAdder struct{ client *redis.Client }

func (r redisStreamAdder) Add(payload string) error {
	if r.client == nil {
		return errors.New("redis audit stream is unavailable")
	}
	return r.client.XAdd(&redis.XAddArgs{Stream: StreamName, Values: map[string]any{streamField: payload}}).Err()
}

func NewProducer(redisClient *redis.Client, repository *storytellerRepo.Repository) *Producer {
	var stream streamAdder
	if redisClient != nil {
		stream = redisStreamAdder{client: redisClient}
	}
	return newProducer(stream, repository)
}

func newProducer(stream streamAdder, store eventStore) *Producer {
	return &Producer{
		stream: stream, store: store, retryDelays: []time.Duration{25 * time.Millisecond, 75 * time.Millisecond}, sleep: time.Sleep,
		logExhausted: func(payload []byte, err error) {
			log.Logger().Error("Storyteller audit event permanently failed",
				zap.ByteString("event", payload), zap.Error(err))
		},
	}
}

// Emit 只能在業務寫入成功後呼叫：先送 Redis Stream，短暫 retry 後改直寫 MySQL，
// 兩層都失敗時將完整 JSON 留在 ERROR log 供 ELK 補寫。
func (p *Producer) Emit(event *storytellerModel.AuditEvent) error {
	if event == nil {
		return errors.New("audit event is nil")
	}
	payload, err := json.Marshal(event)
	if err != nil {
		return err
	}
	var streamErr error
	if p.stream != nil {
		for attempt := 0; attempt <= len(p.retryDelays); attempt++ {
			if streamErr = p.stream.Add(string(payload)); streamErr == nil {
				return nil
			}
			if attempt < len(p.retryDelays) {
				p.sleep(p.retryDelays[attempt])
			}
		}
	} else {
		streamErr = errors.New("redis audit stream is unavailable")
	}
	if p.store != nil {
		if err := p.store.InsertAuditEvents([]*storytellerModel.AuditEvent{event}); err == nil {
			return nil
		} else {
			streamErr = errors.Join(streamErr, err)
		}
	}
	p.logExhausted(payload, streamErr)
	return streamErr
}

var defaultProducer struct {
	sync.RWMutex
	value *Producer
}

func SetDefaultProducer(producer *Producer) {
	defaultProducer.Lock()
	defaultProducer.value = producer
	defaultProducer.Unlock()
}

func Emit(ctx context.Context, input EventInput) error {
	requestContext, ok := RequestContextFrom(ctx)
	if !ok {
		return nil
	}
	event, err := BuildEvent(requestContext, input, time.Now())
	if err != nil {
		return err
	}
	defaultProducer.RLock()
	producer := defaultProducer.value
	defaultProducer.RUnlock()
	if producer == nil {
		return errors.New("default audit producer is not configured")
	}
	return producer.Emit(event)
}
