package storytelleroauth

import (
	"encoding/json"
	"errors"
	"time"

	"faryne.dev/service/helper"
	"github.com/go-redis/redis/v7"
)

// authorizationCode 是授權碼對應的內容，只存 Redis（10 分鐘 TTL），不建表。
type authorizationCode struct {
	ClientID      string `json:"client_id"`
	ClientDBID    uint64 `json:"client_db_id"`
	ClientName    string `json:"client_name"`
	UserID        uint64 `json:"user_id"`
	RedirectURI   string `json:"redirect_uri"`
	CodeChallenge string `json:"code_challenge"`
	Resource      string `json:"resource"`
}

type codeStore interface {
	Save(code string, payload authorizationCode, ttl time.Duration) error
	// Consume 取出並刪除授權碼，同一組碼只能兌換一次；不存在回傳 nil。
	Consume(code string) (*authorizationCode, error)
}

type rateLimiter interface {
	Allow(key string, limit int64, window time.Duration) (bool, error)
}

type redisCodeStore struct{ redis *redis.Client }

// key 用授權碼的雜湊，Redis 裡不留明碼。
func codeKey(code string) string { return "storyteller:oauth:code:" + helper.SHA256Hex(code) }

func (s redisCodeStore) Save(code string, payload authorizationCode, ttl time.Duration) error {
	if s.redis == nil {
		return errors.New("Redis is not configured")
	}
	data, err := json.Marshal(payload)
	if err != nil {
		return err
	}
	return s.redis.Set(codeKey(code), string(data), ttl).Err()
}

func (s redisCodeStore) Consume(code string) (*authorizationCode, error) {
	if s.redis == nil {
		return nil, errors.New("Redis is not configured")
	}
	// MULTI 包住 GET + DEL，兩個請求同時兌換同一組碼時只有一個拿得到內容
	pipe := s.redis.TxPipeline()
	get := pipe.Get(codeKey(code))
	pipe.Del(codeKey(code))
	if _, err := pipe.Exec(); err != nil && !errors.Is(err, redis.Nil) {
		return nil, err
	}
	data, err := get.Result()
	if errors.Is(err, redis.Nil) {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	var payload authorizationCode
	if err := json.Unmarshal([]byte(data), &payload); err != nil {
		return nil, err
	}
	return &payload, nil
}

type redisRateLimiter struct{ redis *redis.Client }

// Allow 是固定視窗計數：第一次 INCR 時設 TTL，超過 limit 就拒絕。
func (l redisRateLimiter) Allow(key string, limit int64, window time.Duration) (bool, error) {
	if l.redis == nil {
		return false, errors.New("Redis is not configured")
	}
	count, err := l.redis.Incr(key).Result()
	if err != nil {
		return false, err
	}
	if count == 1 {
		l.redis.Expire(key, window)
	}
	return count <= limit, nil
}
