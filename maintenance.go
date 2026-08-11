package main

import (
	"strconv"
	"strings"
	"time"

	"faryne.dev/config"
	"faryne.dev/service/log"
	"faryne.dev/service/output"
	"github.com/gofiber/fiber/v3"
)

const maintenanceTimeLayout = "2006-01-02 15:04"

// maintenanceActive 判斷目前是否處於維護模式。
// 有設 MAINTENANCE_START／MAINTENANCE_END 任一個時，改用時間區間判斷，MAINTENANCE_MODE 會被忽略；
// 兩者都沒設才吃 MAINTENANCE_MODE 的手動開關。
// 回傳的 end／hasEnd 供呼叫端算 Retry-After。
func maintenanceActive() (active bool, end time.Time, hasEnd bool) {
	cfg := config.EnvConfig()
	start, hasStart := parseMaintenanceTime(cfg.MaintenanceStart)
	end, hasEnd = parseMaintenanceTime(cfg.MaintenanceEnd)

	if hasStart || hasEnd {
		now := time.Now()
		if hasStart && now.Before(start) {
			return false, time.Time{}, false
		}
		if hasEnd && !now.Before(end) {
			return false, time.Time{}, false
		}
		return true, end, hasEnd
	}

	return cfg.MaintenanceMode, time.Time{}, false
}

func parseMaintenanceTime(value string) (time.Time, bool) {
	value = strings.TrimSpace(value)
	if value == "" {
		return time.Time{}, false
	}
	t, err := time.ParseInLocation(maintenanceTimeLayout, value, time.Local)
	if err != nil {
		log.Logger().Warn("Invalid maintenance time value: " + value + ", error: " + err.Error())
		return time.Time{}, false
	}
	return t, true
}

// maintenanceMiddleware 維護模式期間讓所有請求（除了 /swagger）直接回 503，不進到實際的 route handler。
func maintenanceMiddleware() fiber.Handler {
	return func(c fiber.Ctx) error {
		if strings.HasPrefix(c.Path(), "/swagger") {
			return c.Next()
		}

		active, end, hasEnd := maintenanceActive()
		if !active {
			return c.Next()
		}

		var data any
		if hasEnd {
			if retryAfter := int(time.Until(end).Seconds()); retryAfter > 0 {
				c.Set(fiber.HeaderRetryAfter, strconv.Itoa(retryAfter))
			}
			data = map[string]string{"retry_at": end.Format(time.RFC3339)}
		}
		return output.Maintenance("網站維護中，請稍後再試", data)
	}
}
