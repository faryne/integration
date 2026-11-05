package account

import (
	"bytes"
	"crypto/hmac"
	"crypto/md5"
	"crypto/subtle"
	"encoding/hex"
	"os"
	"strings"
	"sync"

	"faryne.dev/config"
	"faryne.dev/service/log"
	"go.uber.org/zap"
)

// 舊站（2016 年 Laravel 版）的密碼是 hash_hmac('md5', <CloudFront 私鑰 PEM 內容>, 密碼)：
// 密碼當 HMAC 的鑰匙、PEM 內容當訊息。更早期可能是單純 md5(密碼)，使用者也不確定，所以兩種都試。
// PEM 就是 CLOUDFRONT_PRIVATE_KEY_FILE 那把（key pair APKAIEXQ…），檔案結尾換行可能跟當年不同，原始／去尾換行都試。
const (
	schemeHMACPem        = "hmac_md5_pem"
	schemeHMACPemTrimmed = "hmac_md5_pem_trimmed"
	schemeMD5            = "md5"
)

var (
	legacyPemOnce sync.Once
	legacyPem     []byte
)

// loadLegacyPem 讀一次 PEM；讀不到只記 log，之後只能比對單純 md5
func loadLegacyPem() []byte {
	legacyPemOnce.Do(func() {
		path := config.EnvConfig().CloudFrontPrivateKeyFile
		raw, err := os.ReadFile(path)
		if err != nil {
			log.Logger().Warn("Nekomaid legacy password PEM is unavailable; only plain md5 will be checked", zap.Error(err))
			return
		}
		legacyPem = raw
	})
	return legacyPem
}

// legacyPasswordScheme 比對舊雜湊，回傳命中的格式（log 用，上線後看實際分布）
func legacyPasswordScheme(stored, password string) (string, bool) {
	return matchLegacyPassword(stored, password, loadLegacyPem())
}

func matchLegacyPassword(stored, password string, pem []byte) (string, bool) {
	stored = strings.ToLower(strings.TrimSpace(stored))
	if stored == "" || password == "" {
		return "", false
	}
	candidates := make([][2]string, 0, 3)
	if len(pem) > 0 {
		candidates = append(candidates, [2]string{schemeHMACPem, hmacMD5(password, pem)})
		if trimmed := bytes.TrimRight(pem, "\r\n"); len(trimmed) != len(pem) {
			candidates = append(candidates, [2]string{schemeHMACPemTrimmed, hmacMD5(password, trimmed)})
		}
	}
	sum := md5.Sum([]byte(password))
	candidates = append(candidates, [2]string{schemeMD5, hex.EncodeToString(sum[:])})
	for _, c := range candidates {
		if subtle.ConstantTimeCompare([]byte(stored), []byte(c[1])) == 1 {
			return c[0], true
		}
	}
	return "", false
}

// hmacMD5 對應 PHP 的 hash_hmac('md5', message, key)
func hmacMD5(key string, message []byte) string {
	mac := hmac.New(md5.New, []byte(key))
	mac.Write(message)
	return hex.EncodeToString(mac.Sum(nil))
}
