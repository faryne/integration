package av

import (
	"errors"
	"fmt"
	"time"

	"faryne.dev/model/enum"
	"faryne.dev/service/client"
)

const (
	actressSubmitIPKey    = "av:actress-submit:ip:%s"
	actressSubmitIPLimit  = 10
	actressSubmitIPWindow = time.Hour
)

// ErrActressSubmitLimited 這個 IP 一小時內的上稿次數用完，controller 據此回 429
var ErrActressSubmitLimited = errors.New("actress submission ip limit reached")

// acquireActressSubmit 每個 IP 每小時最多 10 張；沒有 IP（例如測試）或 Redis 異常時放行
func acquireActressSubmit(ip string) error {
	r := client.GetRedis(enum.RedisDefault)
	if r == nil || ip == "" {
		return nil
	}
	key := fmt.Sprintf(actressSubmitIPKey, ip)
	if n, err := r.Get(key).Int(); err == nil && n >= actressSubmitIPLimit {
		return ErrActressSubmitLimited
	}
	if count, err := r.Incr(key).Result(); err == nil && count == 1 {
		r.Expire(key, actressSubmitIPWindow)
	}
	return nil
}
