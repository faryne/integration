package sns

import (
	"strings"
	"testing"

	modelSNS "faryne.dev/model/entity/sns"
)

// 女優頁標題帶名字與區塊名稱；同一層的功能頁維持通用卡
func TestBuildMetaAvActress(t *testing.T) {
	meta := BuildMeta(modelSNS.RenderRequest{Path: "/av/actress/%E9%82%A3%E6%B4%A5%E4%B9%83%E3%81%A1%E3%81%AA%E3%81%BF", Query: "xcity_id=22221"})
	if !strings.HasPrefix(meta.Title, "那津乃ちなみ - AV 女優搜尋 | ") {
		t.Fatalf("unexpected title: %q", meta.Title)
	}
	if !strings.HasPrefix(meta.Description, "那津乃ちなみ") || meta.Type != "profile" {
		t.Fatalf("unexpected meta: %+v", meta)
	}

	for _, p := range []string{"/av/actress/topics", "/av/actress/submit", "/av/actress/topics/big-tits"} {
		if meta := BuildMeta(modelSNS.RenderRequest{Path: p}); !strings.HasPrefix(meta.Title, "AV 女優搜尋 | ") {
			t.Fatalf("%s: unexpected title %q", p, meta.Title)
		}
	}
}

// joyu.fyi：nginx 補上 /av 前綴轉進來，canonical 要拿掉前綴、指向 joyu.fyi，站名與預覽圖也換成 joyu 的
func TestBuildMetaJoyu(t *testing.T) {
	cases := []struct{ path, query, canonical string }{
		{"/av", "", "https://joyu.fyi/"},
		{"/av/actress/%E9%82%A3%E6%B4%A5%E4%B9%83%E3%81%A1%E3%81%AA%E3%81%BF", "xcity_id=22221", "https://joyu.fyi/actress/%E9%82%A3%E6%B4%A5%E4%B9%83%E3%81%A1%E3%81%AA%E3%81%BF?xcity_id=22221"},
		{"/av/actress", "name=x", "https://joyu.fyi/actress?name=x"},
		{"/av/actress/topics", "", "https://joyu.fyi/actress/topics"},
		{"/av/video", "", "https://joyu.fyi/video"},
	}
	for _, c := range cases {
		meta := BuildMeta(modelSNS.RenderRequest{Host: "joyu.fyi", Path: c.path, Query: c.query})
		if meta.Canonical != c.canonical {
			t.Fatalf("%s: canonical %q, want %q", c.path, meta.Canonical, c.canonical)
		}
		// 首頁的標題就是站名，其他頁是「頁面 | joyu.fyi」
		if meta.SiteName != joyuSiteName || (c.path != "/av" && !strings.HasSuffix(meta.Title, " | "+joyuSiteName)) || meta.Image != joyuOrigin+joyuDefaultImagePath {
			t.Fatalf("%s: unexpected meta %+v", c.path, meta)
		}
		if strings.Contains(meta.Description, "Faryne") {
			t.Fatalf("%s: description leaks faryne.dev: %q", c.path, meta.Description)
		}
	}
}
