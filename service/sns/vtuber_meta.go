package sns

import (
	"context"
	"fmt"
	"regexp"
	"strings"
	"time"
	"unicode/utf8"

	vtuberEntity "faryne.dev/model/entity/opendata/vtuber"
	modelSNS "faryne.dev/model/entity/sns"
	vtuberService "faryne.dev/service/vtuber"
)

const (
	vtuberTitle             = "VTuber 直播行事曆"
	vtuberDescription       = "hololive 藝人的直播行事曆：直播中、即將直播與過去的直播一次看，也能訂閱 Google 日曆。"
	vtuberNotFoundTitle     = "找不到影片"
	vtuberDescriptionRunes  = 100 // 影片頁描述附上的 YouTube 說明開頭字數
	vtuberVideoFetchTimeout = 5 * time.Second
)

var (
	// 影片掛在上傳頻道的「所有影片」底下：/data/vtubers/@name/videos/:videoId
	vtuberVideoPattern = regexp.MustCompile(`^/data/vtubers/([^/]+)/videos/([A-Za-z0-9_-]{11})$`)
	// 藝人頁與分頁：/data/vtubers/@name、/videos、/calendar、/stats
	vtuberTalentPattern = regexp.MustCompile(`^/data/vtubers/([^/]+)(?:/(videos|calendar|stats))?$`)
	// 各分頁的標題後綴，沒有分頁段就是預設的「即將直播」
	vtuberTalentTabTitles = map[string]string{"": "的直播行事曆", "videos": "的所有影片", "calendar": "的行事曆", "stats": "的頻道統計"}
	// 直播時間一律用台北時間顯示，跟前端 format.ts 一致
	vtuberTimeZone = time.FixedZone("Asia/Taipei", 8*3600)
	// 抽成變數方便測試替換
	fetchVtuberVideo   = vtuberService.GetVideoDetail
	fetchVtuberChannel = vtuberService.GetChannelDetail
)

// applyVtuberVideoMeta 影片頁：標題、頻道與直播時間、YouTube 縮圖。影片不存在或不是追蹤中的頻道回 404；
// YouTube 額度用完等錯誤就維持總覽的通用卡（200），不能讓暫時性錯誤把頁面移出索引
func applyVtuberVideoMeta(meta *modelSNS.Meta, matches []string) {
	ctx, cancel := context.WithTimeout(context.Background(), vtuberVideoFetchTimeout)
	defer cancel()
	video, err := fetchVtuberVideo(ctx, matches[2])
	if err != nil {
		return
	}
	if video == nil {
		meta.Status = 404
		meta.Title = fullTitle(vtuberNotFoundTitle)
		meta.Robots = "noindex, nofollow"
		return
	}
	meta.Title = fullTitle(video.Title)
	meta.Description = vtuberVideoDescription(video)
	// 網址的 handle 跟影片頻道對不上（打錯、藝人改了 handle）：canonical 指向正確網址，舊連結不會變 404
	if !strings.EqualFold(normalizeVtuberHandle(matches[1]), video.ChannelHandle) {
		target := "/data/vtubers/" + video.ChannelHandle + "/videos/" + video.VideoID
		meta.Canonical = absoluteURL(frontendOrigin(), target)
		meta.OpenGraphURL = absoluteURL(frontendOrigin(), "/sns"+target)
		meta.RedirectURL = meta.Canonical
	}
	meta.Type = "video.other"
	if video.ThumbnailURL != "" {
		meta.Image = video.ThumbnailURL
	}
}

// vtuberVideoDescription 「頻道・直播狀態與時間。說明開頭…」
func vtuberVideoDescription(v *vtuberEntity.VideoDetail) string {
	desc := v.ChannelTitle + "・" + vtuberVideoWhen(v) + "。"
	if text := strings.Join(strings.Fields(v.Description), " "); text != "" {
		if utf8.RuneCountInString(text) > vtuberDescriptionRunes {
			text = string([]rune(text)[:vtuberDescriptionRunes]) + "…"
		}
		desc += text
	}
	return desc
}

// vtuberVideoWhen 依直播狀態描述時間；不是直播（存檔、一般影片）就寫上傳日期
func vtuberVideoWhen(v *vtuberEntity.VideoDetail) string {
	if l := v.Live; l != nil {
		switch {
		case l.Status == vtuberEntity.LiveStatusLive && l.ActualStartAt != nil:
			return fmt.Sprintf("直播中，%s（台北時間）開播", taipeiDateTime(*l.ActualStartAt))
		case l.Status == vtuberEntity.LiveStatusEnded && l.ActualStartAt != nil && l.ActualEndAt != nil:
			return fmt.Sprintf("%s（台北時間）開播，直播 %s", taipeiDateTime(*l.ActualStartAt), chineseDuration(l.ActualEndAt.Sub(*l.ActualStartAt)))
		case l.Status == vtuberEntity.LiveStatusUpcoming && l.ScheduledStartAt != nil:
			return fmt.Sprintf("預定 %s（台北時間）開播", taipeiDateTime(*l.ScheduledStartAt))
		}
	}
	if v.PublishedAt != nil {
		return v.PublishedAt.In(vtuberTimeZone).Format("2006/01/02") + " 上傳"
	}
	return "YouTube 影片"
}

// applyVtuberTalentMeta 藝人頁（含分頁）：名稱＋分頁、期別、訂閱數、頻道頭像；找不到藝人回 404，DB 錯誤維持通用卡
func applyVtuberTalentMeta(meta *modelSNS.Meta, matches []string) {
	ch, err := fetchVtuberChannel(matches[1])
	if err != nil {
		return
	}
	if ch == nil {
		meta.Status = 404
		meta.Title = fullTitle("找不到藝人")
		meta.Robots = "noindex, nofollow"
		return
	}
	meta.Title = fullTitle(ch.Title + " " + vtuberTalentTabTitles[matches[2]])
	parts := make([]string, 0, 2)
	if ch.Unit != nil {
		parts = append(parts, ch.Unit.Name)
	}
	if ch.SubscriberCount > 0 {
		parts = append(parts, "訂閱數 "+chineseCount(ch.SubscriberCount))
	}
	prefix := ""
	if len(parts) > 0 {
		prefix = strings.Join(parts, "・") + "。"
	}
	meta.Description = prefix + fmt.Sprintf("查看 %s 直播中、即將直播的節目與所有影片，也能訂閱 Google 日曆。", ch.Title)
	meta.Type = "profile"
	if ch.ThumbnailURL != "" {
		meta.Image = ch.ThumbnailURL
	}
}

// normalizeVtuberHandle 網址上的 handle 可能不帶 @
func normalizeVtuberHandle(handle string) string {
	if strings.HasPrefix(handle, "@") {
		return handle
	}
	return "@" + handle
}

func taipeiDateTime(t time.Time) string {
	return t.In(vtuberTimeZone).Format("2006/01/02 15:04")
}

// chineseDuration 跟前端 format.ts 的 formatDuration 同一套規則：「N 小時 M 分」「N 天 M 小時」
func chineseDuration(d time.Duration) string {
	minutes := int(d.Round(time.Minute) / time.Minute)
	hours, days := minutes/60, minutes/60/24
	switch {
	case minutes < 1:
		return "不到 1 分鐘"
	case hours < 1:
		return fmt.Sprintf("%d 分鐘", minutes)
	case days >= 1 && hours%24 > 0:
		return fmt.Sprintf("%d 天 %d 小時", days, hours%24)
	case days >= 1:
		return fmt.Sprintf("%d 天", days)
	case minutes%60 > 0:
		return fmt.Sprintf("%d 小時 %d 分", hours, minutes%60)
	default:
		return fmt.Sprintf("%d 小時", hours)
	}
}

// chineseCount 一萬以上用「萬」，小數一位（整數就不帶 .0）
func chineseCount(n uint64) string {
	if n < 10000 {
		return fmt.Sprintf("%d", n)
	}
	return strings.TrimSuffix(fmt.Sprintf("%.1f", float64(n)/10000), ".0") + " 萬"
}
