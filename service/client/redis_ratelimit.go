package client

import (
	"errors"
	"time"

	"github.com/go-redis/redis/v7"
)

// AllowFixedWindow 是固定視窗計數：第一次 INCR 時設 TTL，超過 limit 就拒絕。
// OAuth 端點與作者動態的發文／留言頻率限制共用。
func AllowFixedWindow(r *redis.Client, key string, limit int64, window time.Duration) (bool, error) {
	if r == nil {
		return false, errors.New("Redis is not configured")
	}
	count, err := r.Incr(key).Result()
	if err != nil {
		return false, err
	}
	if count == 1 {
		r.Expire(key, window)
	}
	return count <= limit, nil
}
