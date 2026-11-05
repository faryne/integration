package nekomaid

import (
	"errors"
	"strings"
	"testing"

	"faryne.dev/config"
	"faryne.dev/model/entity/nekomaid"
)

func TestNormalizeForbiddenSubmit(t *testing.T) {
	valid := nekomaid.ForbiddenSubmitRequest{Site: "pixiv", AuthorId: "123", ArtworkId: "456", ContactEmail: "artist@example.com", Message: "這是我的作品，請停止收錄"}
	invalid := []struct {
		name   string
		modify func(*nekomaid.ForbiddenSubmitRequest)
	}{
		{"缺畫師 ID", func(r *nekomaid.ForbiddenSubmitRequest) { r.AuthorId = "" }},
		{"不支援的站", func(r *nekomaid.ForbiddenSubmitRequest) { r.Site = "twitter" }},
		{"email 格式錯", func(r *nekomaid.ForbiddenSubmitRequest) { r.ContactEmail = "not-an-email" }},
		{"email 帶顯示名稱", func(r *nekomaid.ForbiddenSubmitRequest) { r.ContactEmail = "Artist <artist@example.com>" }},
		{"說明太長", func(r *nekomaid.ForbiddenSubmitRequest) { r.Message = strings.Repeat("字", forbiddenMessageMaxLen+1) }},
	}
	for _, tc := range invalid {
		t.Run(tc.name, func(t *testing.T) {
			req := valid
			tc.modify(&req)
			if _, err := normalizeForbiddenSubmit(req); !errors.Is(err, ErrForbiddenInvalid) {
				t.Fatalf("err = %v, want ErrForbiddenInvalid", err)
			}
		})
	}

	t.Run("email 與說明留空可以送出（整個畫師）", func(t *testing.T) {
		row, err := normalizeForbiddenSubmit(nekomaid.ForbiddenSubmitRequest{Site: "pixiv", AuthorId: " 123 ", ContactEmail: "  ", Message: " "})
		if err != nil || row.AuthorId != "123" || row.ArtworkId != "" || row.ContactEmail != "" || row.Message != "" {
			t.Fatalf("row = %+v, err = %v", row, err)
		}
	})
}

// withIPHashSecret 測試期間暫時設定 IP 雜湊鑰匙，結束後還原
func withIPHashSecret(t *testing.T, secret string) {
	t.Helper()
	original := config.EnvConfig().NekomaidIPHashSecret
	config.EnvConfig().NekomaidIPHashSecret = secret
	t.Cleanup(func() { config.EnvConfig().NekomaidIPHashSecret = original })
}

func TestSubmitForbiddenHoneypot(t *testing.T) {
	withIPHashSecret(t, "test-secret")
	// honeypot 有值時假裝成功、不碰 DB（欄位全空也不會報驗證錯誤），回傳的 hash 跟真的送出一樣
	result, err := SubmitForbidden(nekomaid.ForbiddenSubmitRequest{Website: "http://spam.example"}, "203.0.113.25")
	want, _ := hashSubmitterIP("203.0.113.25")
	if err != nil || result == nil || result.Hash != want || result.Status != nekomaid.SubmissionPending {
		t.Fatalf("result = %+v, err = %v", result, err)
	}
}

func TestHashSubmitterIP(t *testing.T) {
	withIPHashSecret(t, "test-secret")
	a, _ := hashSubmitterIP("203.0.113.25")
	again, _ := hashSubmitterIP("203.0.113.25")
	other, _ := hashSubmitterIP("203.0.113.26")
	if !ipHashPattern.MatchString(a) || a != again || a == other {
		t.Fatalf("hash = %q, again = %q, other = %q", a, again, other)
	}
	// 換鑰匙後同一 IP 的 hash 也要不同（沒有鑰匙無法從 hash 反推 IP）
	withIPHashSecret(t, "another-secret")
	if b, _ := hashSubmitterIP("203.0.113.25"); b == a {
		t.Fatalf("hash should depend on secret")
	}
	// 沒設鑰匙一律拒絕，不產生可被暴力反推的雜湊
	withIPHashSecret(t, "")
	if _, err := hashSubmitterIP("203.0.113.25"); !errors.Is(err, ErrIPHashSecretMissing) {
		t.Fatalf("err = %v, want ErrIPHashSecretMissing", err)
	}
}

func TestListPublicForbiddenSubmissionsRejectsMalformedHash(t *testing.T) {
	// 格式不對的 hash 直接回空列表，不碰 DB
	for _, hash := range []string{"abc", "../../etc", strings.Repeat("g", 32), strings.Repeat("A", 32)} {
		rows, total, err := ListPublicForbiddenSubmissions(nekomaid.ForbiddenSubmissionPublicRequest{}, hash)
		if err != nil || total != 0 || len(rows) != 0 {
			t.Fatalf("hash %q: rows = %v, total = %d, err = %v", hash, rows, total, err)
		}
	}
}
