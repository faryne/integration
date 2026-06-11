package auth

import (
	"encoding/json"
	"errors"

	modelAuth "faryne.dev/model/entity/auth"
	"faryne.dev/model/enum"
	"faryne.dev/service/client"
)

func GetSessionByEncryptKey(encryptKey string) (*modelAuth.RedisSession, error) {
	r := client.GetRedis(enum.RedisDefault)
	if r == nil {
		return nil, errors.New("Redis is not configured")
	}

	raw, err := r.Get(sessionRedisKey(hashEncryptKey(encryptKey))).Result()
	if err != nil {
		return nil, err
	}

	var session modelAuth.RedisSession
	if err := json.Unmarshal([]byte(raw), &session); err != nil {
		return nil, err
	}
	return &session, nil
}
