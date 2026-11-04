package av

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"strconv"

	"faryne.dev/config"
	"faryne.dev/model/enum"
	"faryne.dev/service/client"
)

// getVideoSources 一次讀多部影片的 ES 原始文件（vid → _source），找不到的不會出現在結果裡。
// 用原始 map 而不是 RawVideo：核准時要整份寫回，不能弄丟 RawVideo 沒定義的欄位
func getVideoSources(ctx context.Context, vids []int) (map[int]map[string]any, error) {
	out := map[int]map[string]any{}
	if len(vids) == 0 {
		return out, nil
	}
	es := client.GetElasticSearch(enum.ESDefault)
	if es == nil {
		return nil, fmt.Errorf("elasticsearch client is not initialized")
	}
	ids := make([]string, 0, len(vids))
	for _, vid := range vids {
		ids = append(ids, strconv.Itoa(vid))
	}
	body, _ := json.Marshal(map[string]any{"ids": ids})
	resp, err := es.Mget(bytes.NewReader(body), es.Mget.WithContext(ctx), es.Mget.WithIndex(config.EnvConfig().DMMVideoIndex))
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()
	raw, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, err
	}
	if resp.IsError() {
		return nil, fmt.Errorf("mget dmm videos failed: status=%s body=%.300s", resp.Status(), raw)
	}
	var res struct {
		Docs []struct {
			ID     string         `json:"_id"`
			Found  bool           `json:"found"`
			Source map[string]any `json:"_source"`
		} `json:"docs"`
	}
	if err := json.Unmarshal(raw, &res); err != nil {
		return nil, err
	}
	for _, d := range res.Docs {
		if vid, err := strconv.Atoi(d.ID); err == nil && d.Found {
			out[vid] = d.Source
		}
	}
	return out, nil
}

// toVideoSource 把要寫進 ES 的文件轉成 map，才能套用覆寫
func toVideoSource(doc any) map[string]any {
	raw, _ := json.Marshal(doc)
	out := map[string]any{}
	_ = json.Unmarshal(raw, &out)
	return out
}
