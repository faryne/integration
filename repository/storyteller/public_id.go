package storyteller

import (
	"crypto/rand"
	"encoding/hex"
)

// newPublicID 產生對外用的 16 碼 hex 識別碼（跟 service 端 randomID 同格式）。
// 帳號與筆名在 repository 寫入時才補，確保所有建立路徑（登入 upsert、補建 profile、建筆名）都有值。
func newPublicID() string {
	buf := make([]byte, 8)
	_, _ = rand.Read(buf)
	return hex.EncodeToString(buf)
}
