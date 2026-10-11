// Package tokenstore 把 OAuth 憑證存在作業系統的鑰匙圈（macOS Keychain／Windows Credential Manager），
// 不落地成明文檔案。以 issuer 當帳號名稱，本機開發與正式站的登入互不干擾。
package tokenstore

import (
	"encoding/json"
	"errors"
	"time"

	"github.com/zalando/go-keyring"
)

const service = "steamloom-writer"

// Credential 是一次授權的完整狀態；refresh 需要 client_id，所以跟 token 存在一起。
type Credential struct {
	ClientID     string    `json:"client_id"`
	AccessToken  string    `json:"access_token"`
	RefreshToken string    `json:"refresh_token"`
	ExpiresAt    time.Time `json:"expires_at"`
}

type Store struct{ account string }

func New(issuer string) *Store { return &Store{account: issuer} }

// Load 沒有存過憑證時回傳 nil, nil。
func (s *Store) Load() (*Credential, error) {
	raw, err := keyring.Get(service, s.account)
	if errors.Is(err, keyring.ErrNotFound) {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	var credential Credential
	if err := json.Unmarshal([]byte(raw), &credential); err != nil {
		// 格式壞掉就當作沒登入，順手清掉
		_ = s.Delete()
		return nil, nil
	}
	return &credential, nil
}

func (s *Store) Save(credential *Credential) error {
	raw, err := json.Marshal(credential)
	if err != nil {
		return err
	}
	return keyring.Set(service, s.account, string(raw))
}

func (s *Store) Delete() error {
	if err := keyring.Delete(service, s.account); err != nil && !errors.Is(err, keyring.ErrNotFound) {
		return err
	}
	return nil
}
