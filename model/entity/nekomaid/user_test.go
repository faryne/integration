package nekomaid

import (
	"testing"
	"time"
)

// 修改 email 只開放給改版前的舊帳號、已搬進 Firebase、還沒整合（email 驗證）
func TestUserCanChangeEmail(t *testing.T) {
	uid, now := "uid", time.Now()
	cases := []struct {
		name string
		user User
		want bool
	}{
		{"舊帳號、已搬家、未驗證", User{Username: "legacy", FirebaseUid: &uid}, true},
		{"舊帳號已驗證（已整合）", User{Username: "legacy", FirebaseUid: &uid, EmailVerifiedAt: &now}, false},
		{"舊帳號還沒搬家", User{Username: "legacy"}, false},
		{"改版後註冊的帳號", User{FirebaseUid: &uid}, false},
	}
	for _, tc := range cases {
		if got := tc.user.CanChangeEmail(); got != tc.want {
			t.Fatalf("%s: got %v, want %v", tc.name, got, tc.want)
		}
	}
}
