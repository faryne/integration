package sns

import (
	"regexp"
	"strings"

	avEntity "faryne.dev/model/entity/opendata/av"
	modelSNS "faryne.dev/model/entity/sns"
	avService "faryne.dev/service/av"
)

const (
	avVideoNotFoundTitle = "找不到影片"
	// 日文片名常常破百字，分享卡標題太長會被平台截得很難看
	avVideoTitleRunes = 60
)

var (
	// 影片詳細頁：/av/video/MDVR-448（官方番號）或 /av/video/h_491love00068（DMM 內部番號）
	avVideoPattern = regexp.MustCompile(`^/av/video/([^/]+)$`)
	// 抽成變數方便測試替換
	fetchAvVideo = func(no string) (*avEntity.CleanVideo, error) {
		_, rows, err := avService.VideoSearch(avEntity.VideoQueryRequest{No: no, Page: 1})
		if err != nil || len(rows) == 0 {
			return nil, err
		}
		return &rows[0], nil
	}
)

// applyAvVideoMeta 影片頁：標題用「番號 片名」、描述放出演／發售商／配信日、圖片用封面。
// 查不到回 404；ES 異常就維持搜尋頁的通用卡（200），不能讓暫時性錯誤把頁面移出索引
func applyAvVideoMeta(meta *modelSNS.Meta, matches []string) {
	video, err := fetchAvVideo(matches[1])
	if err != nil {
		return
	}
	if video == nil {
		meta.Status = 404
		meta.Title = fullTitle(avVideoNotFoundTitle)
		meta.Robots = "noindex, nofollow"
		return
	}
	code := video.MakerNo
	if code == "" {
		code = strings.ToUpper(video.No)
	}
	meta.Title = fullTitle(code + " " + truncateRunes(video.Title, avVideoTitleRunes))
	meta.Description = avVideoDescription(video)
	if video.Thumb != "" {
		meta.Image = video.Thumb
	}
}

// avVideoDescription 例：出演：石原希望、葵いぶき｜ムーディーズ｜配信日 2026/10/26；沒有的段落略過
func avVideoDescription(video *avEntity.CleanVideo) string {
	var parts []string
	if actresses := nonEmpty(video.Actresses); len(actresses) > 0 {
		parts = append(parts, "出演："+strings.Join(limitStrings(actresses, 5), "、"))
	}
	if makers := nonEmpty(video.Makers); len(makers) > 0 {
		parts = append(parts, makers[0])
	}
	if video.VodDate != "" {
		parts = append(parts, "配信日 "+video.VodDate)
	}
	return strings.Join(parts, "｜")
}

func nonEmpty(values []string) []string {
	out := make([]string, 0, len(values))
	for _, v := range values {
		if v = strings.TrimSpace(v); v != "" {
			out = append(out, v)
		}
	}
	return out
}
