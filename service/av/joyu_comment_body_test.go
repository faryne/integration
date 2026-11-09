package av

import (
	"strings"
	"testing"
)

// 留言內容：HTML 標籤與圖片語法直接擋下，數學式的 < 不會誤判；太長、空白的不收
func TestNormalizeCommentBody(t *testing.T) {
	ok := map[string]string{
		"  **好看**\r\n第二行  ": "**好看**\n第二行",
		"a < b 而且 c > d":    "a < b 而且 c > d",
		"[文字](https://x.y)": "[文字](https://x.y)",
	}
	for in, want := range ok {
		if got, err := normalizeCommentBody(in); err != nil || got != want {
			t.Fatalf("%q: got %q, %v", in, got, err)
		}
	}
	bad := map[string]error{
		"   ":                         ErrCommentInvalid,
		"好看<script>alert(1)</script>": ErrCommentHTML,
		"<img src=x onerror=1>":       ErrCommentHTML,
		"![](https://track.example)":  ErrCommentHTML,
		"<!-- 註解 -->":                 ErrCommentHTML,
		strings.Repeat("字", 2001):     ErrCommentTooLong,
	}
	for in, want := range bad {
		if _, err := normalizeCommentBody(in); err != want {
			t.Fatalf("%q: got %v, want %v", in, err, want)
		}
	}
}

// 留言位置：影片番號轉小寫、女優 domain:aid；其他格式不收
func TestParseCommentTarget(t *testing.T) {
	if k, v, err := parseCommentTarget("video:MIDV00900"); err != nil || k != "video" || v != "midv00900" {
		t.Fatalf("video: %s %s %v", k, v, err)
	}
	if k, v, err := parseCommentTarget("actress:xcity:22105"); err != nil || k != "actress" || v != "xcity:22105" {
		t.Fatalf("actress: %s %s %v", k, v, err)
	}
	for _, in := range []string{"", "video:", "actress:dmm:1", "tag:痴女", "video:midv-900"} {
		if _, _, err := parseCommentTarget(in); err == nil {
			t.Fatalf("%q should be invalid", in)
		}
	}
}

// 暱稱：2～20 字、不含保留字與角括號；訪客名固定且以「訪客-」開頭
func TestNicknameAndGuestName(t *testing.T) {
	if got, err := normalizeNickname("  みお推し "); err != nil || got != "みお推し" {
		t.Fatalf("got %q %v", got, err)
	}
	for _, in := range []string{"a", strings.Repeat("長", 21), "訪客-1234", "Joyu官方", "<b>x</b>", "管理員小明"} {
		if _, err := normalizeNickname(in); err == nil {
			t.Fatalf("%q should be invalid", in)
		}
	}
	if a, b := guestName("uid-1"), guestName("uid-1"); a != b || !strings.HasPrefix(a, "訪客-") || len([]rune(a)) != 7 {
		t.Fatalf("guestName: %q %q", a, b)
	}
}
