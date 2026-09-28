package storytelleraudit

import (
	"encoding/json"
	"errors"
	"fmt"
	"os"
	"strings"
	"sync"
	"time"

	storytellerModel "faryne.dev/model/entity/storyteller"
	storytellerRepo "faryne.dev/repository/storyteller"
	"faryne.dev/service/background"
	"faryne.dev/service/log"
	"github.com/go-redis/redis/v7"
	"go.uber.org/zap"
)

const (
	consumerGroup       = "storyteller-audit-writers"
	consumerBatchSize   = 100
	maxDeliveryAttempts = int64(10)
	consumerBlock       = 2 * time.Second
	consumerBaseBackoff = time.Second
	consumerMaxBackoff  = 30 * time.Second
	deadStreamMaxLength = int64(10000)
)

type streamMessage struct {
	ID         string
	Payload    string
	Deliveries int64
}

type consumerStream interface {
	CreateGroup() error
	ReadNew(consumer string, count int64, block time.Duration) ([]streamMessage, error)
	ClaimRetryable(consumer string, count int64) ([]streamMessage, error)
	AckAndDelete(ids ...string) error
	DeadLetter(message streamMessage) error
}

type redisConsumerStream struct{ client *redis.Client }

func (r redisConsumerStream) CreateGroup() error {
	err := r.client.XGroupCreateMkStream(StreamName, consumerGroup, "0").Err()
	if err != nil && !strings.Contains(err.Error(), "BUSYGROUP") {
		return err
	}
	return nil
}

func (r redisConsumerStream) ReadNew(consumer string, count int64, block time.Duration) ([]streamMessage, error) {
	streams, err := r.client.XReadGroup(&redis.XReadGroupArgs{
		Group: consumerGroup, Consumer: consumer, Streams: []string{StreamName, ">"}, Count: count, Block: block,
	}).Result()
	if err != nil {
		return nil, err
	}
	return flattenRedisStreams(streams, nil), nil
}

func (r redisConsumerStream) ClaimRetryable(consumer string, count int64) ([]streamMessage, error) {
	pending, err := r.client.XPendingExt(&redis.XPendingExtArgs{
		Stream: StreamName, Group: consumerGroup, Start: "-", End: "+", Count: count,
	}).Result()
	if err != nil {
		return nil, err
	}
	deliveries, ids := make(map[string]int64), make([]string, 0, len(pending))
	for _, item := range pending {
		if item.Idle < retryBackoff(item.RetryCount) {
			continue
		}
		ids, deliveries[item.ID] = append(ids, item.ID), item.RetryCount+1
	}
	if len(ids) == 0 {
		return nil, nil
	}
	messages, err := r.client.XClaim(&redis.XClaimArgs{
		Stream: StreamName, Group: consumerGroup, Consumer: consumer, MinIdle: 0, Messages: ids,
	}).Result()
	if err != nil {
		return nil, err
	}
	return flattenRedisMessages(messages, deliveries), nil
}

func (r redisConsumerStream) AckAndDelete(ids ...string) error {
	if len(ids) == 0 {
		return nil
	}
	pipe := r.client.TxPipeline()
	pipe.XAck(StreamName, consumerGroup, ids...)
	pipe.XDel(StreamName, ids...)
	_, err := pipe.Exec()
	return err
}

func (r redisConsumerStream) DeadLetter(message streamMessage) error {
	if err := r.client.XAdd(&redis.XAddArgs{Stream: DeadStreamName, MaxLenApprox: deadStreamMaxLength, Values: map[string]any{
		streamField: message.Payload, "original_id": message.ID, "deliveries": message.Deliveries,
	}}).Err(); err != nil {
		return err
	}
	return r.AckAndDelete(message.ID)
}

func flattenRedisStreams(streams []redis.XStream, deliveries map[string]int64) []streamMessage {
	output := make([]streamMessage, 0)
	for _, stream := range streams {
		output = append(output, flattenRedisMessages(stream.Messages, deliveries)...)
	}
	return output
}

func flattenRedisMessages(messages []redis.XMessage, deliveries map[string]int64) []streamMessage {
	output := make([]streamMessage, 0, len(messages))
	for _, message := range messages {
		payload, ok := message.Values[streamField].(string)
		if !ok {
			payload = fmt.Sprint(message.Values[streamField])
		}
		delivery := int64(1)
		if deliveries != nil && deliveries[message.ID] > 0 {
			delivery = deliveries[message.ID]
		}
		output = append(output, streamMessage{ID: message.ID, Payload: payload, Deliveries: delivery})
	}
	return output
}

type Consumer struct {
	stream  consumerStream
	store   eventStore
	tracker *background.Tracker
	stop    chan struct{}
	done    chan struct{}
	once    sync.Once
	name    string
}

func NewConsumer(redisClient *redis.Client, repository *storytellerRepo.Repository, tracker *background.Tracker) *Consumer {
	if redisClient == nil || repository == nil {
		return nil
	}
	return newConsumer(redisConsumerStream{client: redisClient}, repository, tracker)
}

func newConsumer(stream consumerStream, store eventStore, tracker *background.Tracker) *Consumer {
	hostname, _ := os.Hostname()
	return &Consumer{
		stream: stream, store: store, tracker: tracker, stop: make(chan struct{}), done: make(chan struct{}),
		name: fmt.Sprintf("%s-%d", hostname, os.Getpid()),
	}
}

func (c *Consumer) Start() error {
	if c == nil {
		return nil
	}
	finish, err := c.tracker.Track("storyteller audit consumer")
	if err != nil {
		return err
	}
	go func() {
		defer close(c.done)
		defer finish()
		c.loop()
	}()
	return nil
}

func (c *Consumer) Stop() {
	if c == nil {
		return
	}
	c.once.Do(func() { close(c.stop) })
	<-c.done
}

func (c *Consumer) loop() {
	for {
		if err := c.stream.CreateGroup(); err == nil {
			break
		} else {
			log.Logger().Error("Create storyteller audit consumer group failed", zap.Error(err))
		}
		select {
		case <-c.stop:
			return
		case <-time.After(consumerBaseBackoff):
		}
	}
	for {
		select {
		case <-c.stop:
			return
		default:
		}
		if messages, err := c.stream.ClaimRetryable(c.name, consumerBatchSize); err != nil && !errors.Is(err, redis.Nil) {
			log.Logger().Error("Claim storyteller audit events failed", zap.Error(err))
		} else if len(messages) > 0 {
			c.processBatch(messages)
			continue
		}
		messages, err := c.stream.ReadNew(c.name, consumerBatchSize, consumerBlock)
		if err != nil {
			if !errors.Is(err, redis.Nil) {
				log.Logger().Error("Read storyteller audit stream failed", zap.Error(err))
			}
			continue
		}
		c.processBatch(messages)
	}
}

func (c *Consumer) processBatch(messages []streamMessage) {
	events, ids := make([]*storytellerModel.AuditEvent, 0, len(messages)), make([]string, 0, len(messages))
	for _, message := range messages {
		if shouldDeadLetter(message.Deliveries) {
			if err := c.stream.DeadLetter(message); err != nil {
				log.Logger().Error("Move storyteller audit event to dead-letter failed", zap.String("stream_id", message.ID), zap.Error(err))
				continue
			}
			log.Logger().Error("Storyteller audit event moved to dead-letter", zap.String("stream_id", message.ID), zap.Int64("deliveries", message.Deliveries), zap.String("event", message.Payload))
			continue
		}
		var event storytellerModel.AuditEvent
		if err := json.Unmarshal([]byte(message.Payload), &event); err != nil {
			message.Deliveries = maxDeliveryAttempts
			if deadErr := c.stream.DeadLetter(message); deadErr != nil {
				log.Logger().Error("Move invalid storyteller audit event to dead-letter failed", zap.String("stream_id", message.ID), zap.Error(deadErr))
			} else {
				log.Logger().Error("Invalid storyteller audit event moved to dead-letter", zap.String("stream_id", message.ID), zap.String("event", message.Payload), zap.Error(err))
			}
			continue
		}
		events, ids = append(events, &event), append(ids, message.ID)
	}
	if len(events) == 0 {
		return
	}
	if err := c.store.InsertAuditEvents(events); err != nil {
		log.Logger().Error("Insert storyteller audit batch failed", zap.Int("count", len(events)), zap.Error(err))
		c.insertIndividually(events, ids)
		return
	}
	if err := c.stream.AckAndDelete(ids...); err != nil {
		log.Logger().Error("Ack and delete storyteller audit batch failed", zap.Int("count", len(ids)), zap.Error(err))
	}
}

// insertIndividually 隔離批次中的 poison message，避免正常事件一起進入 dead-letter。
func (c *Consumer) insertIndividually(events []*storytellerModel.AuditEvent, ids []string) {
	for index, event := range events {
		if err := c.store.InsertAuditEvents([]*storytellerModel.AuditEvent{event}); err != nil {
			log.Logger().Error("Insert storyteller audit event failed", zap.String("stream_id", ids[index]), zap.Error(err))
			continue
		}
		if err := c.stream.AckAndDelete(ids[index]); err != nil {
			log.Logger().Error("Ack and delete storyteller audit event failed", zap.String("stream_id", ids[index]), zap.Error(err))
		}
	}
}

func shouldDeadLetter(deliveries int64) bool { return deliveries >= maxDeliveryAttempts }

func retryBackoff(deliveries int64) time.Duration {
	if deliveries <= 1 {
		return consumerBaseBackoff
	}
	delay := consumerBaseBackoff << min(deliveries-1, 5)
	if delay > consumerMaxBackoff {
		return consumerMaxBackoff
	}
	return delay
}
