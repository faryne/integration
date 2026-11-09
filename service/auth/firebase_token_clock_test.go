package auth

import (
	"testing"
	"time"

	"github.com/golang-jwt/jwt/v4"
)

// 時間檢查容許 5 分鐘誤差：伺服器時鐘稍慢時剛簽發的 token 要能用，超過誤差的還是要擋
func TestFirebaseClaimsValidClockSkew(t *testing.T) {
	now := time.Now()
	claims := func(iat, exp time.Duration) firebaseClaims {
		return firebaseClaims{RegisteredClaims: jwt.RegisteredClaims{
			IssuedAt:  jwt.NewNumericDate(now.Add(iat)),
			ExpiresAt: jwt.NewNumericDate(now.Add(exp)),
		}}
	}
	cases := []struct {
		name     string
		iat, exp time.Duration
		ok       bool
	}{
		{"剛簽發但伺服器慢 3 秒", 3 * time.Second, time.Hour, true},
		{"一般", -time.Minute, time.Hour, true},
		{"剛過期 1 分鐘（誤差內）", -time.Hour, -time.Minute, true},
		{"簽發時間在 10 分鐘後", 10 * time.Minute, time.Hour, false},
		{"過期 10 分鐘", -2 * time.Hour, -10 * time.Minute, false},
	}
	for _, c := range cases {
		if err := claims(c.iat, c.exp).Valid(); (err == nil) != c.ok {
			t.Fatalf("%s: err = %v, want ok = %v", c.name, err, c.ok)
		}
	}
}
