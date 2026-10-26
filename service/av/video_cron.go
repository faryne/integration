package av

import (
	"context"
	"fmt"
	"html"
	"strings"
	"time"

	"faryne.dev/service/dmm"
	"faryne.dev/service/log"
	"faryne.dev/service/telegram"
	"go.uber.org/zap"
)

const videoNotifyTopN = 10

// RunDMMVideoSync 排程每天同步前一天的配信作品；手動執行可用 -dayFrom／-dayTo（含）回補區間。
// 單日失敗不中斷其他日期，最後有失敗的日期就發 TG 告警。
func RunDMMVideoSync(dayFrom, dayTo string) {
	from, to, err := videoSyncRange(dayFrom, dayTo)
	if err != nil {
		log.Logger().Error("DMM video sync invalid range: " + err.Error())
		return
	}

	var failedDays []string
	for d := from; !d.After(to); d = d.AddDate(0, 0, 1) {
		date := d.Format(time.DateOnly)
		startedAt := time.Now()
		result, err := SyncDMMVideosByDate(context.Background(), date)
		fields := []zap.Field{
			zap.String("date", date),
			zap.Int("fetched", result.Fetched),
			zap.Int("indexed", result.Indexed),
			zap.Int("failed", result.Failed),
			zap.Int("skipped", result.Skipped),
			zap.Duration("elapsed", time.Since(startedAt)),
		}
		if err != nil {
			failedDays = append(failedDays, fmt.Sprintf("%s：%s", date, err.Error()))
			log.Logger().Error("DMM video sync failed: "+err.Error(), fields...)
			continue
		}
		log.Logger().Info("DMM video sync finished", fields...)
	}

	if len(failedDays) > 0 {
		msg := "<b>DMM 影片同步失敗</b>\n\n" + html.EscapeString(strings.Join(failedDays, "\n"))
		if err := telegram.SendMessage(context.Background(), msg); err != nil {
			log.Logger().Error("DMM video sync alert failed: " + err.Error())
		}
	}
}

// videoSyncRange 沒帶參數＝前一天（跟原本 PHP dmm:daily-published 一樣）；只帶 dayFrom＝只跑那一天
func videoSyncRange(dayFrom, dayTo string) (time.Time, time.Time, error) {
	if dayFrom == "" {
		y := time.Now().AddDate(0, 0, -1)
		y = time.Date(y.Year(), y.Month(), y.Day(), 0, 0, 0, 0, time.Local)
		return y, y, nil
	}
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

// RunDMMVideoDailyNotify 把當天（或 -dayFrom 指定日）上架清單前 10 筆發到 TG，取代 PHP dmm:daily；
// 跟 PHP 版一樣先發文字清單，再補一組封面相簿
func RunDMMVideoDailyNotify(day string) {
	if day == "" {
		day = time.Now().Format(time.DateOnly)
	}
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
		actresses := "-"
		if len(v.Actresses) > 0 {
			actresses = strings.Join(v.Actresses, " / ")
		}
		fmt.Fprintf(&sb, "%d <a href=\"%s\">%s</a>\n\t出演：%s\n\n", k+1, html.EscapeString(v.Url), html.EscapeString(v.Title), html.EscapeString(actresses))
		if v.Thumb != "" {
			photos = append(photos, v.Thumb)
		}
	}
	fmt.Fprintf(&sb, "<a href=\"https://www.dmm.co.jp/digital/videoa/-/delivery-list/=/delivery_date=%s/\">更多</a>", day)
	return sb.String(), photos, nil
}
