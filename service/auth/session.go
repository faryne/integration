package auth

import (
	"crypto/rand"
	"crypto/sha256"
	"encoding/base64"
	"encoding/hex"
	"encoding/json"
	"errors"
	"time"

	modelAuth "faryne.dev/model/entity/auth"
	"faryne.dev/model/enum"
	authRepo "faryne.dev/repository/auth"
	"faryne.dev/service/client"
)

const sessionTTL = 24 * time.Hour
const sessionRedisKeyPrefix = "auth:session:"

func CreateSession(idToken string) (*modelAuth.SessionResponse, error) {
	verified, err := VerifyFirebaseIDToken(idToken)
	if err != nil {
		return nil, err
	}

	user, err := authRepo.NewUserRepository().UpsertFirebaseUser(modelAuth.User{
		FirebaseUID: verified.UID,
		Email:       verified.Email,
		DisplayName: verified.DisplayName,
		PhotoURL:    verified.PhotoURL,
	})
	if err != nil {
		return nil, err
	}

	encryptKey, encryptKeyHash, err := newEncryptKey()
	if err != nil {
		return nil, err
	}

	now := time.Now()
	expiresAt := now.Add(sessionTTL)
	session := modelAuth.RedisSession{
		UserId:      user.Id,
		FirebaseUID: user.FirebaseUID,
		CreatedAt:   now.Format(time.RFC3339),
		ExpiresAt:   expiresAt.Format(time.RFC3339),
	}
	if err := storeSession(encryptKeyHash, session); err != nil {
		return nil, err
	}

	return &modelAuth.SessionResponse{
		User: modelAuth.UserResponse{
			Id:          user.Id,
			FirebaseUID: user.FirebaseUID,
			Email:       user.Email,
			DisplayName: user.DisplayName,
			PhotoURL:    user.PhotoURL,
			IsAdmin:     user.IsAdmin,
		},
		EncryptKey: encryptKey,
		ExpiresAt:  expiresAt.Format(time.RFC3339),
	}, nil
}

func DestroySession(encryptKey string) error {
	encryptKeyHash := hashEncryptKey(encryptKey)
	r := client.GetRedis(enum.RedisDefault)
	if r == nil {
		return errors.New("Redis is not configured")
	}
	return r.Del(sessionRedisKey(encryptKeyHash)).Err()
}

func storeSession(encryptKeyHash string, session modelAuth.RedisSession) error {
	r := client.GetRedis(enum.RedisDefault)
	if r == nil {
		return errors.New("Redis is not configured")
	}

	data, err := json.Marshal(session)
	if err != nil {
		return err
	}
	return r.Set(sessionRedisKey(encryptKeyHash), string(data), sessionTTL).Err()
}

func newEncryptKey() (string, string, error) {
	raw := make([]byte, 32)
	if _, err := rand.Read(raw); err != nil {
		return "", "", err
	}

	key := base64.RawURLEncoding.EncodeToString(raw)
	return key, hashEncryptKey(key), nil
}

func hashEncryptKey(encryptKey string) string {
	sum := sha256.Sum256([]byte(encryptKey))
	return hex.EncodeToString(sum[:])
}

func sessionRedisKey(encryptKeyHash string) string {
	return sessionRedisKeyPrefix + encryptKeyHash
}
