package mcp

import (
	"encoding/json"
	"testing"

	avEntity "faryne.dev/model/entity/opendata/av"
)

// 嵌入原本的結構再加 url：JSON 要同時有原本的欄位與 url（原本的結構若加了自訂 MarshalJSON，url 會被吃掉，這裡會抓到）
func TestLinksKeepOriginalFields(t *testing.T) {
	v, _ := json.Marshal(withVideoLinks([]avEntity.CleanVideo{{No: "ssis00001", MakerNo: "SSIS-001"}}))
	var videos []map[string]any
	if err := json.Unmarshal(v, &videos); err != nil {
		t.Fatal(err)
	}
	if videos[0]["no"] != "ssis00001" || videos[0]["url"] != "https://joyu.fyi/video/SSIS-001" {
		t.Fatalf("video row = %v", videos[0])
	}

	a, _ := json.Marshal(withActressLinks([]avEntity.Actress{{Name: "A", Domain: "manual", AID: 7}}))
	var actresses []map[string]any
	if err := json.Unmarshal(a, &actresses); err != nil {
		t.Fatal(err)
	}
	if actresses[0]["name"] != "A" || actresses[0]["url"] != "https://joyu.fyi/actress/A?manual_id=7" {
		t.Fatalf("actress row = %v", actresses[0])
	}
}
