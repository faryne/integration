package crypto

import (
	"crypto/aes"
	"crypto/cipher"
	"crypto/rand"
	"encoding/base64"
	"errors"
	"fmt"
	"io"
	"strings"

	"faryne.dev/config"
)

// 以 master key 做 envelope encryption：每筆資料有自己的隨機 data key（AES-256-GCM），
// data key 再用 master key 加密；master key 來自 STORYTELLER_AGENT_API_KEY_* 設定，
// 可以同時保留多把（key_id:base64），輪替時舊資料仍解得開。
// 原本只給 Provider API key 用，OAuth access token 也共用這一套。

var (
	ErrMasterKeyNotConfigured = errors.New("storyteller agent api key master key is not configured")
	ErrCiphertextInvalid      = errors.New("storyteller agent api key ciphertext is invalid")
)

// Envelope 是加密後要存進 DB 的三個欄位。
type Envelope struct {
	Ciphertext string
	DataKey    string
	KeyID      string
}

type masterKey struct {
	id  string
	key []byte
}

// SealWithMasterKey 用目前啟用中的 master key 加密。
func SealWithMasterKey(plaintext string) (*Envelope, error) {
	key, err := activeMasterKey()
	if err != nil {
		return nil, err
	}
	dataKey := make([]byte, 32)
	if _, err := io.ReadFull(rand.Reader, dataKey); err != nil {
		return nil, err
	}
	ciphertext, err := encryptBytes(dataKey, []byte(plaintext))
	if err != nil {
		return nil, err
	}
	encryptedDataKey, err := encryptBytes(key.key, dataKey)
	if err != nil {
		return nil, err
	}
	return &Envelope{Ciphertext: ciphertext, DataKey: encryptedDataKey, KeyID: key.id}, nil
}

// OpenWithMasterKey 依 envelope 記錄的 key_id 找 master key 解密。
func OpenWithMasterKey(envelope Envelope) (string, error) {
	if strings.TrimSpace(envelope.Ciphertext) == "" {
		return "", ErrCiphertextInvalid
	}
	key, err := masterKeyByID(envelope.KeyID)
	if err != nil {
		return "", fmt.Errorf("load master key %q failed: %w", envelope.KeyID, err)
	}
	rawDataKey, err := decryptBytes(key.key, envelope.DataKey)
	if err != nil {
		return "", fmt.Errorf("decrypt data key with key %q failed: %w", envelope.KeyID, err)
	}
	plaintext, err := decryptBytes(rawDataKey, envelope.Ciphertext)
	if err != nil {
		return "", fmt.Errorf("decrypt ciphertext failed: %w", err)
	}
	return string(plaintext), nil
}

func activeMasterKey() (*masterKey, error) {
	activeID := strings.TrimSpace(config.EnvConfig().StorytellerAgentAPIKeyActiveKeyID)
	if activeID == "" {
		return nil, ErrMasterKeyNotConfigured
	}
	return masterKeyByID(activeID)
}

func masterKeyByID(keyID string) (*masterKey, error) {
	keyID = strings.TrimSpace(keyID)
	if keyID == "" {
		return nil, ErrMasterKeyNotConfigured
	}
	keys, err := parseMasterKeys(config.EnvConfig().StorytellerAgentAPIKeyMasterKeys)
	if err != nil {
		return nil, err
	}
	key, ok := keys[keyID]
	if !ok {
		return nil, fmt.Errorf("%w: %s", ErrMasterKeyNotConfigured, keyID)
	}
	return &masterKey{id: keyID, key: key}, nil
}

func parseMasterKeys(raw string) (map[string][]byte, error) {
	output := make(map[string][]byte)
	for _, item := range strings.Split(raw, ",") {
		item = strings.TrimSpace(item)
		if item == "" {
			continue
		}
		// 格式為 key_id:base64_32_bytes，多組用逗號分隔；保留舊 key 才能解密舊資料。
		id, encoded, ok := strings.Cut(item, ":")
		if !ok {
			return nil, errors.New("storyteller agent api key master key format must be key_id:base64_key")
		}
		key, err := decodeMasterKey(encoded)
		if err != nil {
			return nil, err
		}
		output[strings.TrimSpace(id)] = key
	}
	if len(output) == 0 {
		return nil, ErrMasterKeyNotConfigured
	}
	return output, nil
}

func decodeMasterKey(encoded string) ([]byte, error) {
	encoded = strings.TrimSpace(encoded)
	var lastErr error
	for _, decoder := range []*base64.Encoding{
		base64.RawURLEncoding, base64.URLEncoding, base64.RawStdEncoding, base64.StdEncoding,
	} {
		key, err := decoder.DecodeString(encoded)
		if err == nil {
			if len(key) != 32 {
				return nil, errors.New("storyteller agent api key master key must decode to 32 bytes")
			}
			return key, nil
		}
		lastErr = err
	}
	return nil, lastErr
}

func encryptBytes(key []byte, plaintext []byte) (string, error) {
	gcm, err := newMasterKeyGCM(key)
	if err != nil {
		return "", err
	}
	nonce := make([]byte, nonceSize)
	if _, err := io.ReadFull(rand.Reader, nonce); err != nil {
		return "", err
	}
	payload := append(nonce, gcm.Seal(nil, nonce, plaintext, nil)...)
	return base64.RawURLEncoding.EncodeToString(payload), nil
}

func decryptBytes(key []byte, encrypted string) ([]byte, error) {
	gcm, err := newMasterKeyGCM(key)
	if err != nil {
		return nil, err
	}
	payload, err := base64.RawURLEncoding.DecodeString(encrypted)
	if err != nil {
		return nil, err
	}
	if len(payload) <= nonceSize {
		return nil, ErrCiphertextInvalid
	}
	return gcm.Open(nil, payload[:nonceSize], payload[nonceSize:], nil)
}

func newMasterKeyGCM(key []byte) (cipher.AEAD, error) {
	if len(key) != 32 {
		return nil, errors.New("storyteller agent api key encryption key must be 32 bytes")
	}
	block, err := aes.NewCipher(key)
	if err != nil {
		return nil, err
	}
	return cipher.NewGCM(block)
}
