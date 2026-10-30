package av

import (
	"errors"
	"fmt"
	"time"

	"faryne.dev/model/enum"
	"faryne.dev/service/client"
)

const (
	actressSubmitIPKey = "av:actress-submit:ip:%s"
	// 每個 IP 每小時 60 張（MCP 批次上稿用）；需要時再改成環境變數
	actressSubmitIPLimit  = 60
	actressSubmitIPWindow = time.Hour
)

// ErrActressSubmitLimited 這個 IP 一小時內的上稿次數用完，controller 據此回 429
var ErrActressSubmitLimited = errors.New("actress submission ip limit reached")

// ActressSubmitLimitError 帶上還要等多久才能再送（給 MCP 的 agent 判斷何時重試）
type ActressSubmitLimitError struct {
	RetryAfter time.Duration
}

func (e ActressSubmitLimitError) Error() string {
	return fmt.Sprintf("actress submission ip limit reached (%d per hour); retry after %s",
		actressSubmitIPLimit, e.RetryAfter.Round(time.Second))
}

func (e ActressSubmitLimitError) Is(target error) bool { return target == ErrActressSubmitLimited }

// acquireActressSubmit 每個 IP 每小時最多 60 張（從第一張起算的固定一小時）；沒有 IP（例如測試）或 Redis 異常時放行
func acquireActressSubmit(ip string) error {
	r := client.GetRedis(enum.RedisDefault)
	if r == nil || ip == "" {
		return nil
	}
	key := fmt.Sprintf(actressSubmitIPKey, ip)
	if n, err := r.Get(key).Int(); err == nil && n >= actressSubmitIPLimit {
		ttl, _ := r.TTL(key).Result()
		return ActressSubmitLimitError{RetryAfter: max(ttl, time.Second)}
	}
	if count, err := r.Incr(key).Result(); err == nil && count == 1 {
		r.Expire(key, actressSubmitIPWindow)
	}
	return nil
}
