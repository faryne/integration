package account

import (
	"crypto/md5"
	"encoding/hex"
	"strings"
	"testing"
)

func TestMatchLegacyPassword(t *testing.T) {
	pem := []byte("-----BEGIN RSA PRIVATE KEY-----\nabc\n-----END RSA PRIVATE KEY-----\n")
	trimmed := []byte(strings.TrimRight(string(pem), "\n"))
	plain := md5.Sum([]byte("hunter2"))
	cases := []struct {
		name, stored, password, scheme string
		ok                             bool
	}{
		// PHP：hash_hmac('md5', $pem, $password)
		{"Laravel HMAC", hmacMD5("hunter2", pem), "hunter2", schemeHMACPem, true},
		{"PEM 結尾換行不同", hmacMD5("hunter2", trimmed), "hunter2", schemeHMACPemTrimmed, true},
		{"大寫十六進位", strings.ToUpper(hmacMD5("hunter2", pem)), "hunter2", schemeHMACPem, true},
		{"更早期的單純 md5", hex.EncodeToString(plain[:]), "hunter2", schemeMD5, true},
		{"密碼錯", hmacMD5("hunter2", pem), "hunter3", "", false},
		{"鑰匙與訊息反過來不算", hmacMD5(string(pem), []byte("hunter2")), "hunter2", "", false},
		{"空雜湊（已搬家）", "", "hunter2", "", false},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			scheme, ok := matchLegacyPassword(tc.stored, tc.password, pem)
			if ok != tc.ok || scheme != tc.scheme {
				t.Fatalf("got (%q, %v), want (%q, %v)", scheme, ok, tc.scheme, tc.ok)
			}
		})
	}
	// PEM 讀不到時只比對 md5
	if _, ok := matchLegacyPassword(hmacMD5("hunter2", pem), "hunter2", nil); ok {
		t.Fatal("without PEM, HMAC hashes cannot match")
	}
}
