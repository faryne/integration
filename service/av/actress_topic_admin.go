package av

import (
	"context"
	"encoding/json"
	"time"

	avEntity "faryne.dev/model/entity/opendata/av"
	"faryne.dev/model/enum"
	avRepo "faryne.dev/repository/av"
	authService "faryne.dev/service/auth"
	"faryne.dev/service/client"
)

const (
	actressTopicOptionsKey = "av:actress-topic:options"
	actressTopicOptionsTTL = time.Hour
)

// ListActressTopics 管理列表：全部自訂主題（含停用），依分組與順序
func ListActressTopics(userID uint64) ([]avEntity.ActressTopicAdminItem, error) {
	if err := authService.RequireAdmin(userID); err != nil {
		return nil, err
	}
	rows, err := avRepo.NewActressTopic().List()
	if err != nil {
		return nil, err
	}
	items := make([]avEntity.ActressTopicAdminItem, 0, len(rows))
	for _, row := range rows {
		items = append(items, actressTopicItem(row))
	}
	return items, nil
}

func GetActressTopic(userID, id uint64) (avEntity.ActressTopicAdminItem, error) {
	if err := authService.RequireAdmin(userID); err != nil {
		return avEntity.ActressTopicAdminItem{}, err
	}
	row, err := avRepo.NewActressTopic().FindByID(id)
	if err != nil {
		return avEntity.ActressTopicAdminItem{}, err
	}
	return actressTopicItem(*row), nil
}

// SaveActressTopic 新增（id＝0）或修改自訂主題；儲存後等下一次每週排程才會產生，不即時發佈
func SaveActressTopic(userID, id uint64, req avEntity.ActressTopicSaveRequest) (avEntity.ActressTopicAdminItem, error) {
	if err := authService.RequireAdmin(userID); err != nil {
		return avEntity.ActressTopicAdminItem{}, err
	}
	req, err := normalizeActressTopic(req)
	if err != nil {
		return avEntity.ActressTopicAdminItem{}, err
	}
	repo := avRepo.NewActressTopic()
	if taken, err := repo.SlugTaken(req.Slug, id); err != nil {
		return avEntity.ActressTopicAdminItem{}, err
	} else if taken {
		return avEntity.ActressTopicAdminItem{}, invalidTopic("slug「%s」已經有其他主題在用", req.Slug)
	}
	conditions, err := json.Marshal(req.Conditions)
	if err != nil {
		return avEntity.ActressTopicAdminItem{}, err
	}

	now := time.Now()
	row := &avEntity.AVActressTopic{IsEnabled: true, CreatedBy: &userID, CreatedAt: now}
	if id > 0 {
		if row, err = repo.FindByID(id); err != nil {
			return avEntity.ActressTopicAdminItem{}, err
		}
	}
	// 換分組時排到新分組的最後
	if id == 0 || row.GroupKey != req.GroupKey {
		if row.SortOrder, err = repo.NextSortOrder(req.GroupKey); err != nil {
			return avEntity.ActressTopicAdminItem{}, err
		}
	}
	row.Slug, row.Title, row.GroupKey, row.DefaultSort, row.Conditions = req.Slug, req.Title, req.GroupKey, req.DefaultSort, string(conditions)
	row.UpdatedBy, row.UpdatedAt = &userID, now
	if id == 0 {
		err = repo.Create(row)
	} else {
		err = repo.Save(row)
	}
	if err != nil {
		return avEntity.ActressTopicAdminItem{}, err
	}
	return actressTopicItem(*row), nil
}

func SetActressTopicEnabled(userID, id uint64, enabled bool) error {
	if err := authService.RequireAdmin(userID); err != nil {
		return err
	}
	repo := avRepo.NewActressTopic()
	if _, err := repo.FindByID(id); err != nil {
		return err
	}
	return repo.SetEnabled(id, enabled, userID)
}

// SortActressTopics 依傳入順序重排（前端一次送同分組的全部 id）
func SortActressTopics(userID uint64, ids []uint64) error {
	if err := authService.RequireAdmin(userID); err != nil {
		return err
	}
	return avRepo.NewActressTopic().Reorder(ids)
}

func DeleteActressTopic(userID, id uint64) error {
	if err := authService.RequireAdmin(userID); err != nil {
		return err
	}
	repo := avRepo.NewActressTopic()
	if _, err := repo.FindByID(id); err != nil {
		return err
	}
	return repo.SoftDelete(id, userID)
}

// ActressTopicOptionsFor 編輯頁自動完成的選項：出身地（女優 born_city）與類型（影片標籤，套用類型主題的排除規則），
// 都附數量並依數量排序；Redis 快取 1 小時（Redis 異常時直接查 ES）
func ActressTopicOptionsFor(ctx context.Context, userID uint64) (avEntity.ActressTopicOptions, error) {
	var out avEntity.ActressTopicOptions
	if err := authService.RequireAdmin(userID); err != nil {
		return out, err
	}
	r := client.GetRedis(enum.RedisDefault)
	if r != nil {
		if raw, err := r.Get(actressTopicOptionsKey).Bytes(); err == nil && json.Unmarshal(raw, &out) == nil {
			return out, nil
		}
	}

	var res struct {
		Aggregations struct {
			Cities struct {
				Buckets []struct {
					Key      string `json:"key"`
					DocCount int    `json:"doc_count"`
				} `json:"buckets"`
			} `json:"cities"`
		} `json:"aggregations"`
	}
	body := map[string]any{
		"size":  0,
		"query": actressDomainQuery(actressSearchDomains),
		"aggs":  map[string]any{"cities": termsAgg("born_city.keyword", 500)},
	}
	if err := esSearch(ctx, actressIndexName(), body, &res); err != nil {
		return out, err
	}
	out.BornCities = make([]avEntity.ActressTopicOption, 0, len(res.Aggregations.Cities.Buckets))
	for _, b := range res.Aggregations.Cities.Buckets {
		out.BornCities = append(out.BornCities, avEntity.ActressTopicOption{Value: b.Key, Count: b.DocCount})
	}
	tags, err := fetchGenreTags(ctx)
	if err != nil {
		return out, err
	}
	out.Tags = make([]avEntity.ActressTopicOption, 0, len(tags))
	for _, t := range tags {
		out.Tags = append(out.Tags, avEntity.ActressTopicOption{Value: t.Tag, Count: t.Count})
	}

	if raw, err := json.Marshal(out); err == nil && r != nil {
		r.Set(actressTopicOptionsKey, raw, actressTopicOptionsTTL)
	}
	return out, nil
}

// actressTopicItem DB 一筆轉成管理頁格式；條件 JSON 壞掉時回空條件（摘要會是空的，管理員打開重存即可）
func actressTopicItem(row avEntity.AVActressTopic) avEntity.ActressTopicAdminItem {
	var c avEntity.ActressTopicConditions
	_ = json.Unmarshal([]byte(row.Conditions), &c)
	return avEntity.ActressTopicAdminItem{
		ID: row.ID, Slug: row.Slug, Title: row.Title, GroupKey: row.GroupKey, SortOrder: row.SortOrder,
		DefaultSort: row.DefaultSort, Conditions: c, Summary: topicConditionSummary(c), IsEnabled: row.IsEnabled,
		LastCount: row.LastCount, LastGeneratedAt: row.LastGeneratedAt, UpdatedAt: row.UpdatedAt,
	}
}
