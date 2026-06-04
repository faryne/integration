package client

import (
	"faryne.dev/model/enum"
	"fmt"
	"github.com/go-redis/redis/v7"
)

var redisConnections = make(map[enum.RedisName]*redis.Client)

func InitRedis(name enum.RedisName, dsn string) error {
	if _, ok := redisConnections[name]; ok {
		return fmt.Errorf(
			"connection %s already exists",
			name)
	}
	r := redis.NewClient(&redis.Options{
		Addr: dsn,
	})
	redisConnections[name] = r
	return nil
}

func GetRedis(name enum.RedisName) *redis.Client {
	if _, ok := redisConnections[name]; !ok {
		return nil
	}
	return redisConnections[name]
}

func CloseRedisConnections() error {
	var closeErr error
	for name, conn := range redisConnections {
		if err := conn.Close(); err != nil && closeErr == nil {
			closeErr = err
		}
		delete(redisConnections, name)
	}
	return closeErr
}
