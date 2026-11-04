package av

import (
	"errors"
	"fmt"
	"time"

	"faryne.dev/model/enum"
	"faryne.dev/service/client"
)

const (
	// 女優上稿與影片修改共用同一個額度（2026-11-04 起），key 從 av:actress-submit 改名
	avSubmitIPKey = "av:submit:ip:%s"
	// 每個 IP 每小時 60 張（MCP 批次上稿用）；需要時再改成環境變數
	avSubmitIPLimit  = 60
	avSubmitIPWindow = time.Hour
)

// ErrAVSubmitLimited 這個 IP 一小時內的上稿次數用完，controller 據此回 429
var ErrAVSubmitLimited = errors.New("av submission ip limit reached")

// AVSubmitLimitError 帶上還要等多久才能再送（給 MCP 的 agent 判斷何時重試）
type AVSubmitLimitError struct {
	RetryAfter time.Duration
}

func (e AVSubmitLimitError) Error() string {
	return fmt.Sprintf("av submission ip limit reached (%d per hour, actress and video combined); retry after %s",
		avSubmitIPLimit, e.RetryAfter.Round(time.Second))
}

func (e AVSubmitLimitError) Is(target error) bool { return target == ErrAVSubmitLimited }

// acquireAVSubmit 每個 IP 每小時最多 60 張（從第一張起算的固定一小時）；沒有 IP（例如測試）或 Redis 異常時放行
func acquireAVSubmit(ip string) error {
	r := client.GetRedis(enum.RedisDefault)
	if r == nil || ip == "" {
		return nil
	}
	key := fmt.Sprintf(avSubmitIPKey, ip)
	if n, err := r.Get(key).Int(); err == nil && n >= avSubmitIPLimit {
		ttl, _ := r.TTL(key).Result()
		return AVSubmitLimitError{RetryAfter: max(ttl, time.Second)}
	}
	if count, err := r.Incr(key).Result(); err == nil && count == 1 {
		r.Expire(key, avSubmitIPWindow)
	}
	return nil
}
