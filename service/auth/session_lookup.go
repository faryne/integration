package auth

import (
	"encoding/json"
	"errors"
	"time"

	modelAuth "faryne.dev/model/entity/auth"
	"faryne.dev/model/enum"
	"faryne.dev/service/client"
)

// GetSessionByEncryptKey 讀取 session 的同時做 sliding TTL 續期：
// 只要使用者還在活動（有打 API），過期時間就往後延，不用等 24 小時到期才重建。
func GetSessionByEncryptKey(encryptKey string) (*modelAuth.RedisSession, error) {
	r := client.GetRedis(enum.RedisDefault)
	if r == nil {
		return nil, errors.New("Redis is not configured")
	}

	key := sessionRedisKey(hashEncryptKey(encryptKey))
	raw, err := r.Get(key).Result()
	if err != nil {
		return nil, err
	}

	var session modelAuth.RedisSession
	if err := json.Unmarshal([]byte(raw), &session); err != nil {
		return nil, err
	}

	session.ExpiresAt = time.Now().Add(sessionTTL).Format(time.RFC3339)
	if data, err := json.Marshal(session); err == nil {
		r.Set(key, string(data), sessionTTL)
	}
	return &session, nil
}
