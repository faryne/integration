package nekomaid

import (
	"encoding/json"
	"slices"
	"strings"
	"testing"

	"faryne.dev/model/entity/nekomaid"
	"faryne.dev/model/enum"
)

func TestIsTakedownTarget(t *testing.T) {
	author := nekomaid.ArtworkForbidden{Site: enum.NekomaidSitePixiv, AuthorId: "123"}
	artwork := nekomaid.ArtworkForbidden{Site: enum.NekomaidSitePixiv, AuthorId: "123", ArtworkId: "456"}
	legacy := nekomaid.ArtworkForbidden{Site: enum.NekomaidSiteNico, ArtworkId: "im2379754"}
	cases := []struct {
		name   string
		row    nekomaid.ArtworkForbidden
		source string
		want   bool
	}{
		{"畫師層級命中", author, `{"from":"pixiv","author_id":"123","artwork_id":"1"}`, true},
		{"舊文件 ID 存成數字也算", author, `{"from":"pixiv","author_id":123,"artwork_id":1}`, true},
		{"別的畫師（match 分詞誤中）不算", author, `{"from":"pixiv","author_id":"123-x","artwork_id":"1"}`, false},
		{"別的站不算", author, `{"from":"nico","author_id":"123","artwork_id":"1"}`, false},
		{"作品層級命中", artwork, `{"from":"pixiv","author_id":"123","artwork_id":"456"}`, true},
		{"作品層級只刪那一件", artwork, `{"from":"pixiv","author_id":"123","artwork_id":"457"}`, false},
		// 舊版單一作品禁抓：畫師 ID 空白（prod 2012～2013 的舊作品）
		{"畫師空白的作品：空字串命中", legacy, `{"from":"nico","author_id":"","artwork_id":"im2379754"}`, true},
		{"畫師空白的作品：欄位是 null 也算", legacy, `{"from":"nico","author_id":null,"artwork_id":"im2379754"}`, true},
		{"畫師空白的作品：欄位不存在也算", legacy, `{"from":"nico","artwork_id":"im2379754"}`, true},
		{"畫師空白的作品：別件不算", legacy, `{"from":"nico","author_id":"","artwork_id":"im1670668"}`, false},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			var source map[string]any
			decoder := json.NewDecoder(strings.NewReader(tc.source))
			decoder.UseNumber()
			if err := decoder.Decode(&source); err != nil {
				t.Fatal(err)
			}
			if got := isTakedownTarget(tc.row, source); got != tc.want {
				t.Fatalf("isTakedownTarget = %v, want %v", got, tc.want)
			}
		})
	}
}

func TestArtworkObjectKeys(t *testing.T) {
	photos := []nekomaid.ArtworkPhoto{
		// 新版：Filename 是 key，Url 指向同一個 key（去重）、Original 指向來源站（略過）
		{Filename: "pixiv/1/2_abc.jpg", Url: "https://pcdn1.ha2.tw/pixiv/1/2_abc.jpg", Original: "https://i.pximg.net/img/2.jpg"},
		// 舊資料沒有 Filename，靠 Url 補；http 也認得
		{Url: "http://cdn-pixiv.maid.tw/pixiv/1/2_abc_p1.jpg"},
		// ugoira：Original 是本站的 zip
		{Filename: "ugoira/pixiv/2/2_def.webm", Original: "https://pcdn2.ha2.tw/ugoira/pixiv/2/2_def.zip"},
		// 外站網址不能刪
		{Url: "https://example.com/pixiv/1/x.jpg"},
	}
	got := artworkObjectKeys(photos, "https://pcdn1.ha2.tw/thumb/pixiv/1/2_abc_thumb.jpg")
	want := []string{
		"pixiv/1/2_abc.jpg",
		"pixiv/1/2_abc_p1.jpg",
		"ugoira/pixiv/2/2_def.webm",
		"ugoira/pixiv/2/2_def.zip",
		"thumb/pixiv/1/2_abc_thumb.jpg",
	}
	if !slices.Equal(got, want) {
		t.Fatalf("keys = %v, want %v", got, want)
	}
}

func TestTakedownQuery(t *testing.T) {
	// 畫師 ID 空白時不能帶 author_id 條件（match 空字串查不到任何文件，單一作品禁抓會失效）
	got, _ := json.Marshal(takedownQuery(nekomaid.ArtworkForbidden{Site: enum.NekomaidSiteNico, ArtworkId: "im2379754"}))
	if strings.Contains(string(got), "author_id") || !strings.Contains(string(got), `"artwork_id":"im2379754"`) {
		t.Fatalf("query = %s", got)
	}
	// 整個畫師時不能帶 artwork_id 條件
	got, _ = json.Marshal(takedownQuery(nekomaid.ArtworkForbidden{Site: enum.NekomaidSitePixiv, AuthorId: "123"}))
	if strings.Contains(string(got), "artwork_id") || !strings.Contains(string(got), `"author_id":"123"`) {
		t.Fatalf("query = %s", got)
	}
}
