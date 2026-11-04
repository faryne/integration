package nekomaid

import (
	"errors"
	"strings"
	"testing"

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

func TestSubmitForbiddenHoneypot(t *testing.T) {
	// honeypot 有值時假裝成功、不碰 DB（欄位全空也不會報驗證錯誤）
	result, err := SubmitForbidden(nekomaid.ForbiddenSubmitRequest{Website: "http://spam.example"}, "")
	if err != nil || result == nil || len(result.Token) != 32 || result.Status != nekomaid.SubmissionPending {
		t.Fatalf("result = %+v, err = %v", result, err)
	}
}
