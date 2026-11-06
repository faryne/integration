package av

import "encoding/json"

// toVideoSource 把要寫進影片索引的文件轉成 map，才能套用覆寫
func toVideoSource(doc any) map[string]any {
	raw, _ := json.Marshal(doc)
	out := map[string]any{}
	_ = json.Unmarshal(raw, &out)
	return out
}
