package auth

import (
	"crypto/rand"
	"crypto/sha256"
	"encoding/base64"
)

// randomString 產生 base64url（無 padding）亂數字串，32 bytes 編碼後 43 字元，符合 PKCE verifier 長度下限。
func randomString() string {
	buf := make([]byte, 32)
	_, _ = rand.Read(buf)
	return base64.RawURLEncoding.EncodeToString(buf)
}

// codeChallenge 是 PKCE S256：BASE64URL(SHA256(verifier))。
func codeChallenge(verifier string) string {
	sum := sha256.Sum256([]byte(verifier))
	return base64.RawURLEncoding.EncodeToString(sum[:])
}
