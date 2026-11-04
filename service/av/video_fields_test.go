package av

import (
	"errors"
	"reflect"
	"testing"

	avEntity "faryne.dev/model/entity/opendata/av"
)

func TestNormalizeVideoFields(t *testing.T) {
	f, err := normalizeVideoFields(avEntity.VideoFields{
		Title: "  タイトル ", VodDate: "2014-3-7", Actresses: []string{" みひな", "", "みひな", "永瀬ゆい"},
		Links: []avEntity.ActressLink{{URL: " https://example.com "}, {URL: ""}, {URL: "https://example.com"}},
	})
	if err != nil {
		t.Fatal(err)
	}
	if f.Title != "タイトル" || f.VodDate != "2014/03/07" {
		t.Errorf("title/date not normalized: %q %q", f.Title, f.VodDate)
	}
	if !reflect.DeepEqual(f.Actresses, []string{"みひな", "永瀬ゆい"}) || len(f.Links) != 1 || f.Tags == nil {
		t.Errorf("lists not normalized: %#v %#v %#v", f.Actresses, f.Links, f.Tags)
	}
	for _, bad := range []avEntity.VideoFields{
		{Title: ""},
		{Title: "a", VodDate: "2014/02/30"},
		{Title: "a", PublishDate: "20140307"},
		{Title: "a", Duration: -1},
		{Title: "a", Links: []avEntity.ActressLink{{URL: "javascript:alert(1)"}}},
	} {
		if _, err := normalizeVideoFields(bad); !errors.Is(err, ErrActressInvalid) {
			t.Errorf("%#v: want ErrActressInvalid, got %v", bad, err)
		}
	}
}

func TestAlignActressIDs(t *testing.T) {
	got := alignActressIDs([]string{"A", "B", "A"}, []string{"1", "2", "3"}, []string{"A", "C", "A", "A"})
	if want := []string{"1", "", "3", ""}; !reflect.DeepEqual(got, want) {
		t.Errorf("got %v, want %v", got, want)
	}
	// 舊資料 actress_ids 比名單短，缺的當成空字串
	if got := alignActressIDs([]string{"A", "B"}, []string{"1"}, []string{"B", "A"}); !reflect.DeepEqual(got, []string{"", "1"}) {
		t.Errorf("short ids: got %v", got)
	}
}

func TestApplyVideoValuesActressIDs(t *testing.T) {
	values := videoFieldMap(avEntity.VideoFields{Title: "t", Actresses: []string{"B", "C"}})
	// 有 actress_ids：跟著出演重新對齊
	src := map[string]any{"actresses": []any{"A", "B"}, "actress_ids": []any{"1", "2"}, "thumb": "x"}
	applyVideoValues(src, values, []string{"actresses"})
	if !reflect.DeepEqual(src["actress_ids"], []string{"2", ""}) || src["thumb"] != "x" || src["title"] != nil {
		t.Errorf("with ids: %#v", src)
	}
	// 舊片沒有 actress_ids：維持沒有，女優頁才會繼續把它算給對照表裡的女優
	legacy := map[string]any{"actresses": []any{"A"}}
	applyVideoValues(legacy, values, []string{"actresses"})
	if _, ok := legacy["actress_ids"]; ok {
		t.Errorf("legacy doc should not get actress_ids: %#v", legacy)
	}
}

func TestVideoOverridesRoundTrip(t *testing.T) {
	payload := avEntity.VideoFields{Title: "new", MakerNo: "LOVE-068", Tags: []string{"x"}}
	raw := mergeVideoOverrides(`{"series":["S"]}`, payload, []string{"maker_no"})
	src := map[string]any{"title": "dmm", "maker_no": "", "series": []any{}, "tags": []any{"y"}}
	applyVideoOverrides(src, raw)
	f := videoFieldsFromSource(src)
	// 只有覆寫過的欄位（series、maker_no）被蓋，title／tags 維持 DMM 的值
	if f.MakerNo != "LOVE-068" || !reflect.DeepEqual(f.Series, []string{"S"}) || f.Title != "dmm" || !reflect.DeepEqual(f.Tags, []string{"y"}) {
		t.Errorf("unexpected fields: %#v", f)
	}
}

func TestVideoFieldsFromSourceLegacyTypes(t *testing.T) {
	f := videoFieldsFromSource(map[string]any{
		"title": "t", "publish_date": false, "duration": float64(120),
		"directors": []any{"D", nil, " D "}, "series": "S",
	})
	if f.PublishDate != "" || f.Duration != 120 || !reflect.DeepEqual(f.Directors, []string{"D"}) || !reflect.DeepEqual(f.Series, []string{"S"}) {
		t.Errorf("unexpected fields: %#v", f)
	}
	if changed := changedVideoFields(f, f); len(changed) != 0 {
		t.Errorf("same fields should have no diff: %v", changed)
	}
}

func TestAddedTerms(t *testing.T) {
	got := addedTerms(avEntity.VideoFields{Tags: []string{"a"}}, avEntity.VideoFields{Tags: []string{"a", "b"}, Actresses: []string{"X"}})
	if want := map[string][]string{"tags": {"b"}, "actresses": {"X"}}; !reflect.DeepEqual(got, want) {
		t.Errorf("got %v, want %v", got, want)
	}
}
