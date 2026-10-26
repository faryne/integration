package av

import (
	"errors"
	"fmt"
	"strings"
	"time"

	"faryne.dev/model/enum"
	"faryne.dev/service/client"
)

const (
	videoSyncIPKey       = "av:video-sync:ip:%s"
	videoSyncCooldownKey = "av:video-sync:no:%s"
	videoSyncIPLimit     = 10
	videoSyncIPWindow    = time.Hour
	// 同一部作品不論成功或失敗都冷卻一天：成功的不用再抓，下架的再抓也一樣
	videoSyncCooldown = 24 * time.Hour
)

var (
	// ErrVideoSyncIPLimited 這個 IP 一小時內的同步次數用完，controller 據此回 429
	ErrVideoSyncIPLimited = errors.New("video sync ip limit reached")
	// ErrVideoSyncCooldown 這部作品 24 小時內同步過，controller 據此回 429
	ErrVideoSyncCooldown = errors.New("video sync cooldown")
	// ErrVideoNoMakerNo DMM 查得到但沒有官方番號，已標成 orphan
	ErrVideoNoMakerNo = errors.New("dmm video has no maker no")
	// ErrVideoSyncNotVisible 已寫入但用官方番號還查不到，視為暫時性失敗
	ErrVideoSyncNotVisible = errors.New("synced video not visible yet")
)

// AcquireVideoSync 檢查並占用一次同步額度：先占作品冷卻（SETNX），再計 IP 次數。
// 檢查與計次不是原子操作，同時送出可能多算一次，影響不大；Redis 異常時放行
func AcquireVideoSync(ip, no string) error {
	r := client.GetRedis(enum.RedisDefault)
	if r == nil {
		return nil
	}
	ipKey := fmt.Sprintf(videoSyncIPKey, ip)
	if n, err := r.Get(ipKey).Int(); err == nil && n >= videoSyncIPLimit {
		return ErrVideoSyncIPLimited
	}
	// 番號大小寫不同（舊資料大寫、新資料小寫）視為同一部
	if ok, err := r.SetNX(fmt.Sprintf(videoSyncCooldownKey, strings.ToLower(no)), 1, videoSyncCooldown).Result(); err == nil && !ok {
		return ErrVideoSyncCooldown
	}
	if count, err := r.Incr(ipKey).Result(); err == nil && count == 1 {
		r.Expire(ipKey, videoSyncIPWindow)
	}
	return nil
}

// ReleaseVideoSync DMM 暫時性失敗（逾時、改 schema）時解除作品冷卻，讓使用者稍後可以再按
func ReleaseVideoSync(no string) {
	if r := client.GetRedis(enum.RedisDefault); r != nil {
		r.Del(fmt.Sprintf(videoSyncCooldownKey, strings.ToLower(no)))
	}
}
