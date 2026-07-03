package storyteller

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
	storytellerModel "faryne.dev/model/entity/storyteller"
)

const agentAPIKeyNonceSize = 12

var (
	errAgentAPIKeyMasterKeyNotConfigured = errors.New("storyteller agent api key master key is not configured")
	errAgentAPIKeyCiphertextInvalid      = errors.New("storyteller agent api key ciphertext is invalid")
)

type agentAPIKeyMasterKey struct {
	id  string
	key []byte
}

type encryptedAgentAPIKey struct {
	ciphertext string
	dataKey    string
	keyID      string
}

func encryptAgentAPIKey(plaintext string) (*encryptedAgentAPIKey, error) {
	key, err := activeAgentAPIKeyMasterKey()
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
	return &encryptedAgentAPIKey{
		ciphertext: ciphertext,
		dataKey:    encryptedDataKey,
		keyID:      key.id,
	}, nil
}

func decryptProviderAPIKey(key *storytellerModel.ProviderAPIKey) (string, error) {
	if strings.TrimSpace(key.APIKeyEncrypted) == "" {
		return "", errAgentAPIKeyCiphertextInvalid
	}
	masterKey, err := agentAPIKeyMasterKeyByID(key.APIKeyKeyID)
	if err != nil {
		return "", fmt.Errorf("load master key %q failed: %w", key.APIKeyKeyID, err)
	}
	rawDataKey, err := decryptBytes(masterKey.key, key.APIKeyDataKey)
	if err != nil {
		return "", fmt.Errorf("decrypt data key with key %q failed: %w", key.APIKeyKeyID, err)
	}
	plaintext, err := decryptBytes(rawDataKey, key.APIKeyEncrypted)
	if err != nil {
		return "", fmt.Errorf("decrypt api key ciphertext failed: %w", err)
	}
	return strings.TrimSpace(string(plaintext)), nil
}

func applyEncryptedProviderAPIKey(key *storytellerModel.ProviderAPIKey, plaintext string) error {
	encrypted, err := encryptAgentAPIKey(strings.TrimSpace(plaintext))
	if err != nil {
		return err
	}
	key.APIKeyEncrypted = encrypted.ciphertext
	key.APIKeyDataKey = encrypted.dataKey
	key.APIKeyKeyID = encrypted.keyID
	return nil
}

func activeAgentAPIKeyMasterKey() (*agentAPIKeyMasterKey, error) {
	activeID := strings.TrimSpace(config.EnvConfig().StorytellerAgentAPIKeyActiveKeyID)
	if activeID == "" {
		return nil, errAgentAPIKeyMasterKeyNotConfigured
	}
	return agentAPIKeyMasterKeyByID(activeID)
}

func agentAPIKeyMasterKeyByID(keyID string) (*agentAPIKeyMasterKey, error) {
	keyID = strings.TrimSpace(keyID)
	if keyID == "" {
		return nil, errAgentAPIKeyMasterKeyNotConfigured
	}
	keys, err := parseAgentAPIKeyMasterKeys(config.EnvConfig().StorytellerAgentAPIKeyMasterKeys)
	if err != nil {
		return nil, err
	}
	key, ok := keys[keyID]
	if !ok {
		return nil, fmt.Errorf("%w: %s", errAgentAPIKeyMasterKeyNotConfigured, keyID)
	}
	return &agentAPIKeyMasterKey{id: keyID, key: key}, nil
}

func parseAgentAPIKeyMasterKeys(raw string) (map[string][]byte, error) {
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
		key, err := decodeAgentAPIKeyMasterKey(encoded)
		if err != nil {
			return nil, err
		}
		output[strings.TrimSpace(id)] = key
	}
	if len(output) == 0 {
		return nil, errAgentAPIKeyMasterKeyNotConfigured
	}
	return output, nil
}

func decodeAgentAPIKeyMasterKey(encoded string) ([]byte, error) {
	encoded = strings.TrimSpace(encoded)
	decoders := []*base64.Encoding{
		base64.RawURLEncoding,
		base64.URLEncoding,
		base64.RawStdEncoding,
		base64.StdEncoding,
	}
	var lastErr error
	for _, decoder := range decoders {
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
	gcm, err := newAgentAPIKeyGCM(key)
	if err != nil {
		return "", err
	}
	nonce := make([]byte, agentAPIKeyNonceSize)
	if _, err := io.ReadFull(rand.Reader, nonce); err != nil {
		return "", err
	}
	ciphertext := gcm.Seal(nil, nonce, plaintext, nil)
	payload := append(nonce, ciphertext...)
	return base64.RawURLEncoding.EncodeToString(payload), nil
}

func decryptBytes(key []byte, encrypted string) ([]byte, error) {
	gcm, err := newAgentAPIKeyGCM(key)
	if err != nil {
		return nil, err
	}
	payload, err := base64.RawURLEncoding.DecodeString(encrypted)
	if err != nil {
		return nil, err
	}
	if len(payload) <= agentAPIKeyNonceSize {
		return nil, errAgentAPIKeyCiphertextInvalid
	}
	nonce := payload[:agentAPIKeyNonceSize]
	ciphertext := payload[agentAPIKeyNonceSize:]
	return gcm.Open(nil, nonce, ciphertext, nil)
}

func newAgentAPIKeyGCM(key []byte) (cipher.AEAD, error) {
	if len(key) != 32 {
		return nil, errors.New("storyteller agent api key encryption key must be 32 bytes")
	}
	block, err := aes.NewCipher(key)
	if err != nil {
		return nil, err
	}
	return cipher.NewGCM(block)
}
