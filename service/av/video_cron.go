package av

import (
	"context"
	"errors"
	"fmt"
	"html"
	"strings"
	"time"

	"faryne.dev/service/dmm"
	"faryne.dev/service/log"
	"faryne.dev/service/telegram"
	"go.uber.org/zap"
)

const (
	videoNotifyTopN = 10
	// videoSyncMaxFailStreak 連續幾天失敗就中止整段回補：多半是被 DMM 擋了，繼續打只會被擋更久
	videoSyncMaxFailStreak = 3
	// videoSyncAlertMaxRunes TG 單則上限 4096 字，失敗日期太多時截斷，避免連告警都發不出去
	videoSyncAlertMaxRunes = 3500
)

// errVideoDetailsMostlyFailed 清單抓得到、明細卻過半失敗，視同被擋；不然整段日期會顯示成功但其實是空的
var errVideoDetailsMostlyFailed = errors.New("over half of video details failed, possibly blocked by DMM")

// VideoSyncSchedule av-dmm-video-sync 的排程：03 點補前一天整天，05、22 點同步當天，
// 22 點是當天最後一次，同步完才發 TG 通知（10 點後陸續上架的片當天就進站，隔天凌晨再補一次不會漏）
var VideoSyncSchedule = fmt.Sprintf("0 3,%d,%d * * *", videoSyncTodayFromHour, videoNotifyHour)

const (
	videoSyncTodayFromHour = 5  // 這個整點之前跑＝補前一天，之後＝同步當天
	videoNotifyHour        = 22 // 當天最後一次同步，同步完才發通知
)

// RunDMMVideoSync 排程與手動共用入口。沒帶 dayFrom 時依現在整點決定：05 點前補前一天，之後同步當天，22 點同步完發通知
// （cron 在同一個 process 裡共用命令列參數，三個時段分不出來，所以靠整點判斷）。
// 手動執行可用 -dayFrom／-dayTo（含）回補區間，-notify 1 會在同步完發 dayFrom 那天的通知。
// 通知裡的片在網站上一定查得到；同步失敗仍照常發通知（失敗另有 TG 告警）
func RunDMMVideoSync(dayFrom, dayTo string, notify bool) {
	if dayFrom == "" {
		now := time.Now()
		day := now
		if now.Hour() < videoSyncTodayFromHour {
			day = now.AddDate(0, 0, -1)
		}
		dayFrom, notify = day.Format(time.DateOnly), notify || now.Hour() == videoNotifyHour
	}
	syncDMMVideoRange(dayFrom, dayTo)
	if notify {
		RunDMMVideoDailyNotify(dayFrom)
	}
}

// syncDMMVideoRange 同步 dayFrom～dayTo（含；沒帶 dayTo 就只跑 dayFrom）的配信作品。
// 單日失敗不中斷其他日期，但連續失敗 videoSyncMaxFailStreak 天就中止；最後有失敗的日期就發 TG 告警。
func syncDMMVideoRange(dayFrom, dayTo string) {
	from, to, err := videoSyncRange(dayFrom, dayTo)
	if err != nil {
		log.Logger().Error("DMM video sync invalid range: " + err.Error())
		return
	}

	var failedDays []string
	abortNote, streak := "", 0
	for d := from; !d.After(to); d = d.AddDate(0, 0, 1) {
		date := d.Format(time.DateOnly)
		startedAt := time.Now()
		result, err := SyncDMMVideosByDate(context.Background(), date)
		if err == nil && result.Failed*2 > result.Fetched {
			err = errVideoDetailsMostlyFailed
		}
		fields := []zap.Field{
			zap.String("date", date),
			zap.Int("fetched", result.Fetched),
			zap.Int("indexed", result.Indexed),
			zap.Int("failed", result.Failed),
			zap.Int("skipped", result.Skipped),
			zap.Duration("elapsed", time.Since(startedAt)),
		}
		if err == nil {
			streak = 0
			log.Logger().Info("DMM video sync finished", fields...)
			continue
		}
		failedDays = append(failedDays, fmt.Sprintf("%s：%s", date, err.Error()))
		log.Logger().Error("DMM video sync failed: "+err.Error(), fields...)
		if streak++; streak >= videoSyncMaxFailStreak && d.Before(to) {
			// 連續失敗的那幾天也要重跑，所以從這段失敗的第一天算起
			abortNote = fmt.Sprintf("連續 %d 天失敗，已中止；排除問題後用 -dayFrom %s 重跑", streak, d.AddDate(0, 0, 1-streak).Format(time.DateOnly))
			log.Logger().Error("DMM video sync aborted: " + abortNote)
			break
		}
	}

	if len(failedDays) > 0 {
		body := strings.Join(failedDays, "\n")
		if abortNote != "" {
			body = abortNote + "\n\n" + body
		}
		if t := truncateRunes(body, videoSyncAlertMaxRunes); t != body {
			body = t + "\n…（太長已截斷，完整清單見 log）"
		}
		msg := "<b>DMM 影片同步失敗</b>\n\n" + html.EscapeString(body)
		if err := telegram.SendMessage(context.Background(), msg); err != nil {
			log.Logger().Error("DMM video sync alert failed: " + err.Error())
		}
	}
}

// videoSyncRange 只帶 dayFrom＝只跑那一天
func videoSyncRange(dayFrom, dayTo string) (time.Time, time.Time, error) {
	if dayTo == "" {
		dayTo = dayFrom
	}
	from, err := time.ParseInLocation(time.DateOnly, dayFrom, time.Local)
	if err != nil {
		return from, from, err
	}
	to, err := time.ParseInLocation(time.DateOnly, dayTo, time.Local)
	if err != nil {
		return from, to, err
	}
	if to.Before(from) {
		return from, to, fmt.Errorf("dayTo %s is before dayFrom %s", dayTo, dayFrom)
	}
	return from, to, nil
}

// RunDMMVideoDailyNotify 把 day 的上架清單前 10 筆發到 TG，取代 PHP dmm:daily；
// 跟 PHP 版一樣先發文字清單，再補一組封面相簿
func RunDMMVideoDailyNotify(day string) {
	ctx := context.Background()
	msg, photos, err := buildVideoNotifyMessage(day)
	if err != nil {
		log.Logger().Error("DMM video notify failed: " + err.Error())
		msg = "<b>DMM " + day + " 上架影片通知失敗</b>\n\n" + html.EscapeString(err.Error())
	}
	if msg == "" {
		log.Logger().Info("DMM video notify skipped: no videos", zap.String("date", day))
		return
	}
	if err := telegram.SendMessage(ctx, msg); err != nil {
		log.Logger().Error("DMM video notify send failed: " + err.Error())
		return
	}
	// 相簿失敗（例如某張封面 Telegram 抓不到）不影響已經送出的文字清單，只記 log
	if err := telegram.SendPhotos(ctx, photos); err != nil {
		log.Logger().Error("DMM video notify photos send failed: " + err.Error())
	}
}

// buildVideoNotifyMessage 只需要第一頁；明細抓不到的作品直接略過，不讓通知整則失敗。
// 另外回傳同樣這幾筆的封面網址（直式 ps.jpg），順序與清單編號一致
func buildVideoNotifyMessage(day string) (string, []string, error) {
	videos, _, err := dmm.NewDMMClient().SearchVideosByDaily(day, 1)
	if err != nil {
		return "", nil, err
	}
	if len(videos) == 0 {
		return "", nil, nil
	}

	var sb strings.Builder
	var photos []string
	sb.WriteString("<b>DMM " + day + " 上架影片</b>\n\n")
	for k, v := range videos[:min(len(videos), videoNotifyTopN)] {
		fmt.Fprintf(&sb, "%d <a href=\"%s\">%s</a>\n", k+1, html.EscapeString(v.Url), html.EscapeString(v.Title))
		// 沒有出演資訊（素人、合集等）就整行省略，不顯示「出演：-」
		if len(v.Actresses) > 0 {
			sb.WriteString("\t出演：" + html.EscapeString(strings.Join(v.Actresses, " / ")) + "\n")
		}
		sb.WriteString("\n")
		if v.Thumb != "" {
			photos = append(photos, v.Thumb)
		}
	}
	fmt.Fprintf(&sb, "<a href=\"https://www.dmm.co.jp/digital/videoa/-/delivery-list/=/delivery_date=%s/\">更多</a>", day)
	return sb.String(), photos, nil
}
