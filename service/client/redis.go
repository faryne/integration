package client

import (
	"fmt"

	"faryne.dev/model/enum"
	"faryne.dev/service/log"
	"github.com/go-redis/redis/v7"
	"go.uber.org/zap"
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
	for name, conn := range redisConnections {
		if err := conn.Close(); err != nil {
			log.Logger().Warn("Close Redis connection failed during shutdown",
				zap.String("name", string(name)),
				zap.Error(err),
			)
		}
		delete(redisConnections, name)
	}
	return nil
}
