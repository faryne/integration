package helper

import (
	"crypto/sha256"
	"encoding/hex"
)

func SHA256Hex(input string) string {
	sum := sha256.Sum256([]byte(input))
	return hex.EncodeToString(sum[:])
}

func ShortSHA256Hex(input string, length int) string {
	out := SHA256Hex(input)
	if length <= 0 || length >= len(out) {
		return out
	}
	return out[:length]
}
