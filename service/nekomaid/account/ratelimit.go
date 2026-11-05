package account

import (
	"fmt"
	"strings"
	"time"

	"faryne.dev/model/enum"
	"faryne.dev/service/client"
)

// 限流：所有登入都從伺服器打 Firebase，Firebase 看到的是同一個伺服器 IP；
// 被它擋下會讓所有人都登不進去，所以我們自己的限制要比 Firebase 嚴，在前面先擋（規格 §2.3）
const rateLimitWindow = 15 * time.Minute

// allow 固定視窗計數：視窗內超過 max 次就擋；沒有 key（例如測試沒有 IP）或 Redis 異常時放行
func allow(key string, max int64, window time.Duration) bool {
	r := client.GetRedis(enum.RedisDefault)
	if r == nil || strings.HasSuffix(key, ":") {
		return true
	}
	count, err := r.Incr(key).Result()
	if err != nil {
		return true
	}
	if count == 1 {
		r.Expire(key, window)
	}
	return count <= max
}

// allowLogin 每個 IP 15 分鐘 20 次、每個帳號（或 email）15 分鐘 10 次
func allowLogin(ip, login string) bool {
	return allow(fmt.Sprintf("nekomaid:login:ip:%s", ip), 20, rateLimitWindow) &&
		allow(fmt.Sprintf("nekomaid:login:account:%s", strings.ToLower(login)), 10, rateLimitWindow)
}

// allowRegister 每個 IP 每小時 5 個新帳號
func allowRegister(ip string) bool {
	return allow(fmt.Sprintf("nekomaid:register:ip:%s", ip), 5, time.Hour)
}

// allowPasswordReset 每個 IP 每小時 5 次、每個 email 每小時 3 次
func allowPasswordReset(ip, email string) bool {
	return allow(fmt.Sprintf("nekomaid:reset:ip:%s", ip), 5, time.Hour) &&
		allow(fmt.Sprintf("nekomaid:reset:email:%s", strings.ToLower(email)), 3, time.Hour)
}
