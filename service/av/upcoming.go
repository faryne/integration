package av

import (
	"context"
	"time"

	"faryne.dev/model/entity"
	avEntity "faryne.dev/model/entity/opendata/av"
	avRepo "faryne.dev/repository/av"
	repoSearch "faryne.dev/repository/search"
)

// 即將發售的查詢：預約作品跟已配信的在同一個影片索引，條件跟影片搜尋一樣（出演、發售商…），
// 只是加上 Upcoming（配信日在明天以後）

// upcomingWindow 預設範圍：明天起 upcomingDays 天（日本時間；EndDate 不含當天）
func upcomingWindow() (entity.OnlyDateFormat, entity.OnlyDateFormat) {
	now := time.Now().In(jst)
	today := time.Date(now.Year(), now.Month(), now.Day(), 0, 0, 0, 0, jst)
	return entity.OnlyDateFormat(today.AddDate(0, 0, 1)), entity.OnlyDateFormat(today.AddDate(0, 0, upcomingDays+1))
}

// upcomingIndexQuery 搜尋條件轉成只查即將發售的索引查詢：沒指定結束日期時是 30 天內，沒指定排序時配信日近的在前
func upcomingIndexQuery(input avEntity.VideoQueryRequest) (avEntity.VideoIndexQuery, error) {
	if input.EndDate == nil {
		_, end := upcomingWindow()
		input.EndDate = &end
	}
	if input.Sort == "" {
		input.Sort = avEntity.VideoSortSoonest
	}
	q, err := videoIndexQuery(input)
	q.Upcoming = true
	return q, err
}

func cleanVideos(page repoSearch.Page[avEntity.RawVideo]) []avEntity.CleanVideo {
	rows := make([]avEntity.CleanVideo, 0, len(page.Hits))
	for _, h := range page.Hits {
		rows = append(rows, fVideo(h.Source))
	}
	return rows
}

// UpcomingSearch 即將發售列表（一頁 30 筆）
func UpcomingSearch(input avEntity.VideoQueryRequest) (repoSearch.Page[avEntity.RawVideo], []avEntity.CleanVideo, error) {
	q, err := upcomingIndexQuery(input)
	if err != nil {
		return repoSearch.Page[avEntity.RawVideo]{}, nil, err
	}
	page, err := avRepo.NewVideoIndex().Search(context.Background(), q)
	return page, cleanVideos(page), err
}

// UpcomingDates 即將發售頁的日期列：每天幾部
func UpcomingDates(input avEntity.VideoQueryRequest) ([]avEntity.VideoDateCount, error) {
	q, err := upcomingIndexQuery(input)
	if err != nil {
		return nil, err
	}
	return avRepo.NewVideoIndex().CountByDate(context.Background(), q)
}

// JoyuFollowUpcoming 即將發售頁「我追蹤的」：符合任一筆追蹤的預約作品，依配信日近的在前
func JoyuFollowUpcoming(ctx context.Context, uid string, page int) (repoSearch.Page[avEntity.RawVideo], []avEntity.CleanVideo, error) {
	queries, err := followUpcomingQueries(uid)
	if err != nil || len(queries) == 0 {
		return repoSearch.Page[avEntity.RawVideo]{}, []avEntity.CleanVideo{}, err
	}
	p, err := avRepo.NewVideoIndex().SearchAny(ctx, queries, page, avEntity.VideoSortSoonest)
	return p, cleanVideos(p), err
}

// followUpcomingQueries 這個人每筆追蹤對應的即將發售查詢（未來 30 天）
func followUpcomingQueries(uid string) ([]avEntity.VideoIndexQuery, error) {
	follows, err := avRepo.NewJoyuFollow().ListByUID(uid)
	if err != nil || len(follows) == 0 {
		return nil, err
	}
	actresses, profiles, err := followActresses(follows)
	if err != nil {
		return nil, err
	}
	var out []avEntity.VideoIndexQuery
	for _, f := range follows {
		_, req, ok := followItem(f, actresses, profiles)
		if !ok {
			continue
		}
		q, err := upcomingIndexQuery(req)
		if err != nil {
			return nil, err
		}
		out = append(out, q)
	}
	return out, nil
}
