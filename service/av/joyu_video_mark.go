package av

import (
	"context"
	"errors"
	"math"
	"regexp"
	"slices"
	"strings"

	avEntity "faryne.dev/model/entity/opendata/av"
	avRepo "faryne.dev/repository/av"
)

// joyu.fyi 片單：想看／看過＋評分。規格見 DevelopDocuments/opendata/joyu.fyi社群功能第二期_2026-11-09.md

const (
	// joyuMarkLimit 每人片單上限（卡片小標要讀整份清單，不能無限長）
	joyuMarkLimit = 5000
	// joyuRatingMinCount 評分人數到這個數字才公開平均，避免一個人就決定分數
	joyuRatingMinCount = 3
	// joyuMarkPageSize 片單頁一頁幾部（跟影片搜尋一樣）
	joyuMarkPageSize = 30
)

var (
	ErrMarkInvalid = errors.New("片單的內容不正確")
	ErrMarkLimit   = errors.New("片單數量已達上限（5000 部）")
)

// videoNoPattern DMM 內部番號：英數與底線（例：midv00900、h_1234abc00001）
var videoNoPattern = regexp.MustCompile(`^[a-z0-9_]{2,32}$`)

// normalizeVideoNo 番號一律存小寫；格式不對回空字串
func normalizeVideoNo(no string) string {
	if no = strings.ToLower(strings.TrimSpace(no)); videoNoPattern.MatchString(no) {
		return no
	}
	return ""
}

// ListJoyuMarks 全部片單（輕量），全站卡片小標與影片頁按鈕狀態用
func ListJoyuMarks(uid string) ([]avEntity.JoyuVideoMark, error) {
	return avRepo.NewJoyuVideoMark().ListByUID(uid)
}

// SetJoyuMark 設定想看／看過與評分：想看不能有評分（一律歸零），評分只能 0～5
func SetJoyuMark(uid, no string, req avEntity.JoyuVideoMarkRequest) error {
	no = normalizeVideoNo(no)
	if no == "" || !slices.Contains([]string{avEntity.VideoMarkWant, avEntity.VideoMarkWatched}, req.Status) || req.Rating < 0 || req.Rating > 5 {
		return ErrMarkInvalid
	}
	if req.Status == avEntity.VideoMarkWant {
		req.Rating = 0
	}
	repo := avRepo.NewJoyuVideoMark()
	// 已經在片單裡的只是改狀態，不算上限
	exists, err := repo.Exists(uid, no)
	if err != nil {
		return err
	}
	if !exists {
		n, err := repo.CountByUID(uid)
		if err != nil {
			return err
		}
		if n >= joyuMarkLimit {
			return ErrMarkLimit
		}
	}
	return repo.Upsert(uid, no, req.Status, req.Rating)
}

func RemoveJoyuMark(uid, no string) error {
	if no = normalizeVideoNo(no); no == "" {
		return ErrMarkInvalid
	}
	return avRepo.NewJoyuVideoMark().Remove(uid, no)
}

// JoyuMarkSummary 一部影片的全站統計；評分人數少於 joyuRatingMinCount 時不給平均
func JoyuMarkSummary(no string) (avEntity.JoyuVideoMarkSummary, error) {
	if no = normalizeVideoNo(no); no == "" {
		return avEntity.JoyuVideoMarkSummary{}, ErrMarkInvalid
	}
	want, watched, count, avg, err := avRepo.NewJoyuVideoMark().Summary(no)
	out := avEntity.JoyuVideoMarkSummary{Want: want, Watched: watched, RatingCount: count}
	if count >= joyuRatingMinCount {
		rounded := math.Round(avg*10) / 10
		out.RatingAvg = &rounded
	}
	return out, err
}

// JoyuMarkedVideos 我的片單頁：依加入時間時由 DB 分頁再補影片資料；依配信日時把符合篩選的番號全交給搜尋索引排序分頁
func JoyuMarkedVideos(ctx context.Context, uid string, req avEntity.JoyuMarkedVideosRequest) ([]avEntity.JoyuMarkedVideo, int64, error) {
	if !slices.Contains([]string{avEntity.VideoMarkWant, avEntity.VideoMarkWatched}, req.Status) {
		return nil, 0, ErrMarkInvalid
	}
	page := max(req.Page, 1)
	repo, idx := avRepo.NewJoyuVideoMark(), avRepo.NewVideoIndex()

	if req.Sort == "date" {
		marks, err := repo.AllByUID(uid, req.Status, req.Rating)
		if err != nil || len(marks) == 0 {
			return []avEntity.JoyuMarkedVideo{}, 0, err
		}
		byNo := make(map[string]avEntity.JoyuVideoMark, len(marks))
		nos := make([]string, 0, len(marks))
		for _, m := range marks {
			byNo[m.VideoNo], nos = m, append(nos, m.VideoNo)
		}
		r, err := idx.FindByNos(ctx, nos, page, true)
		if err != nil {
			return nil, 0, err
		}
		// 索引裡找不到的（已下架）不會出現在依配信日的排序裡
		out := make([]avEntity.JoyuMarkedVideo, 0, len(r.Hits))
		for _, h := range r.Hits {
			v := fVideo(h.Source)
			out = append(out, avEntity.JoyuMarkedVideo{Mark: byNo[strings.ToLower(v.No)], Video: &v})
		}
		return out, r.Total, nil
	}

	marks, total, err := repo.PageByUID(uid, req.Status, req.Rating, page, joyuMarkPageSize)
	if err != nil || len(marks) == 0 {
		return []avEntity.JoyuMarkedVideo{}, total, err
	}
	nos := make([]string, 0, len(marks))
	for _, m := range marks {
		nos = append(nos, m.VideoNo)
	}
	r, err := idx.FindByNos(ctx, nos, 1, false)
	if err != nil {
		return nil, 0, err
	}
	videos := make(map[string]avEntity.CleanVideo, len(r.Hits))
	for _, h := range r.Hits {
		v := fVideo(h.Source)
		videos[strings.ToLower(v.No)] = v
	}
	// 維持加入時間的順序；索引裡找不到的照樣列出（只有番號），讓人還能從片單移除
	out := make([]avEntity.JoyuMarkedVideo, 0, len(marks))
	for _, m := range marks {
		item := avEntity.JoyuMarkedVideo{Mark: m}
		if v, ok := videos[m.VideoNo]; ok {
			item.Video = &v
		}
		out = append(out, item)
	}
	return out, total, nil
}
