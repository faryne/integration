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
