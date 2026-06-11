package crypto

import (
	"crypto/aes"
	"crypto/cipher"
	"crypto/rand"
	"encoding/base64"
	"errors"
	"io"
)

const nonceSize = 12

func EncryptString(encryptKey string, plaintext string) (string, error) {
	gcm, err := newGCM(encryptKey)
	if err != nil {
		return "", err
	}

	nonce := make([]byte, nonceSize)
	if _, err := io.ReadFull(rand.Reader, nonce); err != nil {
		return "", err
	}

	ciphertext := gcm.Seal(nil, nonce, []byte(plaintext), nil)
	payload := append(nonce, ciphertext...)
	return base64.RawURLEncoding.EncodeToString(payload), nil
}

func DecryptString(encryptKey string, encrypted string) (string, error) {
	gcm, err := newGCM(encryptKey)
	if err != nil {
		return "", err
	}

	payload, err := base64.RawURLEncoding.DecodeString(encrypted)
	if err != nil {
		return "", err
	}
	if len(payload) <= nonceSize {
		return "", errors.New("encrypted payload is too short")
	}

	nonce := payload[:nonceSize]
	ciphertext := payload[nonceSize:]
	plaintext, err := gcm.Open(nil, nonce, ciphertext, nil)
	if err != nil {
		return "", err
	}
	return string(plaintext), nil
}

func newGCM(encryptKey string) (cipher.AEAD, error) {
	key, err := base64.RawURLEncoding.DecodeString(encryptKey)
	if err != nil {
		return nil, err
	}
	if len(key) != 32 {
		return nil, errors.New("encrypt_key must decode to 32 bytes")
	}

	block, err := aes.NewCipher(key)
	if err != nil {
		return nil, err
	}
	return cipher.NewGCM(block)
}
