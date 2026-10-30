package av

import (
	"errors"
	"slices"
	"testing"

	avEntity "faryne.dev/model/entity/opendata/av"
)

func TestNormalizeActressFields(t *testing.T) {
	f, err := normalizeActressFields(avEntity.ActressFields{
		Name: " 水城ひなの ", Cup: "k",
		Interests: []string{"ゲーム", " ゲーム ", ""},
		Links:     []avEntity.ActressLink{{URL: "https://x.com/a"}, {Title: "dup", URL: "https://x.com/a"}, {URL: ""}},
	})
	if err != nil {
		t.Fatal(err)
	}
	if f.Name != "水城ひなの" || f.Cup != "K" || len(f.Interests) != 1 || len(f.Links) != 1 {
		t.Fatalf("unexpected normalize result: %+v", f)
	}

	for _, bad := range []avEntity.ActressFields{
		{},
		{Name: "a", Cup: "AAAA"},
		{Name: "a", Cup: "B1"},
		{Name: "a", Photo: "javascript:alert(1)"},
		{Name: "a", Links: []avEntity.ActressLink{{URL: "ftp://x"}}},
		{Name: "a", Height: 300},
		{Name: "a", BirthMonth: 13},
	} {
		if _, err := normalizeActressFields(bad); !errors.Is(err, ErrActressInvalid) {
			t.Errorf("expected invalid for %+v, got %v", bad, err)
		}
	}
}

func TestChangedAndApplyActressFields(t *testing.T) {
	base := avEntity.ActressFields{Name: "あおいれな", Height: 158, Cup: "A", Interests: []string{"カラオケ"}}
	payload := base
	payload.Height, payload.Cup = 157, "B"
	keys := changedActressFields(base, payload)
	if !slices.Equal(keys, []string{"height", "cup"}) {
		t.Fatalf("changed keys = %v", keys)
	}

	// 提交後身高被同步改成 159、出生地被補上：只套用提交者改的欄位，其他保留現值
	current := base
	current.Height, current.BornCity = 159, "東京都"
	got := applyActressFields(current, payload, keys)
	if got.Height != 157 || got.Cup != "B" || got.BornCity != "東京都" {
		t.Fatalf("apply result = %+v", got)
	}
}

func TestMergeActressFields(t *testing.T) {
	current := avEntity.ActressFields{Name: "水城ひなの", Photo: "https://img/old.jpg", Interests: []string{"a"},
		Links: []avEntity.ActressLink{{URL: "https://a"}}}
	submitted := avEntity.ActressFields{Name: "水城ひなの", Height: 152, Interests: []string{"a", "b"},
		Links: []avEntity.ActressLink{{URL: "https://a"}, {URL: "https://b"}}}
	merged, keys := mergeActressFields(current, submitted)
	if merged.Photo != "https://img/old.jpg" || merged.Height != 152 {
		t.Fatalf("empty fields should keep current value: %+v", merged)
	}
	if !slices.Equal(merged.Interests, []string{"a", "b"}) || len(merged.Links) != 2 {
		t.Fatalf("lists should be unioned: %+v", merged)
	}
	if !slices.Equal(keys, []string{"height", "interests", "links"}) {
		t.Fatalf("merged keys = %v", keys)
	}
}

func TestActressOverrides(t *testing.T) {
	edited := avEntity.ActressFields{Name: "あおいれな", Cup: "B", Links: []avEntity.ActressLink{{URL: "https://x.com/a"}}}
	overrides := addActressOverrides(decodeActressOverrides(nil), edited, []string{"cup", "links"})
	raw := encodeActressOverrides(overrides)

	// xcity 同步抓到舊值與新身高：覆寫的欄位蓋回去，沒覆寫的照 xcity 更新
	synced := avEntity.ActressFields{Name: "あおいれな", Cup: "A", Height: 159}
	got := withActressOverrides(synced, decodeActressOverrides(raw))
	if got.Cup != "B" || got.Height != 159 || len(got.Links) != 1 {
		t.Fatalf("override result = %+v", got)
	}
}
