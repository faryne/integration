package opendata

import (
	"errors"
	"net/http"
	"regexp"

	"github.com/gofiber/fiber/v3"
	"go.uber.org/zap"

	"faryne.dev/service/av"
	"faryne.dev/service/dmm"
	"faryne.dev/service/log"
	"faryne.dev/service/output"
)

const (
	// customCodeAvVideoSyncIPLimited 這個 IP 一小時內的「同步資料」次數用完
	customCodeAvVideoSyncIPLimited output.CustomCode = "429004"
	// customCodeAvVideoSyncCooldown 這部作品 24 小時內同步過
	customCodeAvVideoSyncCooldown output.CustomCode = "429005"
)

// DMM 內部番號只會有英數與底線（例：mdvr00448、h_491love00068），擋掉其他輸入避免汙染 Redis key
var dmmContentIDPattern = regexp.MustCompile(`^[A-Za-z0-9_]{1,32}$`)

// AvVideoSync re-fetches one video from DMM by its internal content id.
// @Summary Sync one AV video from DMM
// @Tags OpenData AV
// @Produce json
// @Param no path string true "DMM content id"
// @Success 200 {object} output.CommonOutput
// @Failure 400 {object} output.CommonOutput
// @Failure 404 {object} output.CommonOutput
// @Failure 429 {object} output.CommonOutput
// @Failure 502 {object} output.CommonOutput
// @Router /opendata/av/video/{no}/sync [post]
func AvVideoSync(ctx fiber.Ctx) error {
	no := ctx.Params("no")
	if !dmmContentIDPattern.MatchString(no) {
		return output.New(http.StatusBadRequest, "", nil, "番號格式不正確")
	}
	switch err := av.AcquireVideoSync(ctx.IP(), no); {
	case errors.Is(err, av.ErrVideoSyncIPLimited):
		return output.New(http.StatusTooManyRequests, customCodeAvVideoSyncIPLimited, nil, "同步次數已達上限，請一小時後再試")
	case errors.Is(err, av.ErrVideoSyncCooldown):
		return output.New(http.StatusTooManyRequests, customCodeAvVideoSyncCooldown, nil, "這部作品今天已經同步過了")
	}

	v, err := av.SyncDMMVideoByNo(ctx.Context(), no)
	switch {
	// 確定失敗：已標成 orphan，前端重新查詢後就不會再顯示同步按鈕
	case errors.Is(err, dmm.ErrVideoNotFound):
		return output.New(http.StatusNotFound, "", nil, "DMM 已查無此作品")
	case errors.Is(err, av.ErrVideoNoMakerNo):
		return output.New(http.StatusNotFound, "", nil, "DMM 沒有提供這部作品的官方番號")
	case err != nil:
		// 暫時性失敗不佔冷卻，讓使用者稍後可以再按；原因只記 log，不回給使用者
		log.Logger().Warn("AV video sync failed: "+err.Error(), zap.String("no", no))
		av.ReleaseVideoSync(no)
		return output.New(http.StatusBadGateway, "", nil, "暫時無法同步，請稍後再試")
	}
	return output.Success(map[string]string{"no": v.No, "maker_no": v.MakerNo})
}
