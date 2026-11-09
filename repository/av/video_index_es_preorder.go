package av

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strconv"
	"strings"

	"faryne.dev/model/entity/opendata/av"
)

// 即將發售排程用的兩個操作：預約作品跟已配信的放在同一個索引，配信當天每日同步會覆寫同一筆（release_status 跟著消失）

// PreOrders 即將發售排程寫入、還沒被每日同步覆寫的作品：fetched_at 只有排程會寫，配信後整份覆寫就沒了（數量在幾千筆內）
func (videoIndexES) PreOrders(ctx context.Context) (map[string]av.VideoPreOrder, error) {
	es, err := esClient()
	if err != nil {
		return nil, err
	}
	body := `{"size":10000,"_source":["vid","no","vod_date","fetched_at","thumb"],"query":{"exists":{"field":"fetched_at"}}}`
	resp, err := es.Search(es.Search.WithContext(ctx), es.Search.WithIndex(videoIndexName()), es.Search.WithBody(strings.NewReader(body)))
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()
	if resp.IsError() {
		raw, _ := io.ReadAll(resp.Body)
		return nil, fmt.Errorf("search pre-orders failed: %s %.300s", resp.Status(), raw)
	}
	var res struct {
		Hits struct {
			Hits []struct {
				Source av.VideoPreOrder `json:"_source"`
			} `json:"hits"`
		} `json:"hits"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&res); err != nil {
		return nil, err
	}
	out := make(map[string]av.VideoPreOrder, len(res.Hits.Hits))
	for _, h := range res.Hits.Hits {
		out[strings.ToLower(h.Source.No)] = h.Source
	}
	return out, nil
}

// Delete 刪掉一部；本來就不存在也算成功
func (videoIndexES) Delete(ctx context.Context, vid int) error {
	es, err := esClient()
	if err != nil {
		return err
	}
	resp, err := es.Delete(videoIndexName(), strconv.Itoa(vid), es.Delete.WithContext(ctx))
	if err != nil {
		return err
	}
	defer resp.Body.Close()
	if resp.IsError() && resp.StatusCode != http.StatusNotFound {
		return fmt.Errorf("delete dmm video failed: status=%s vid=%d", resp.Status(), vid)
	}
	return nil
}
