package storyteller

import (
	"crypto/rand"
	"encoding/hex"
	"errors"
	"strings"
	"time"

	storytellerModel "faryne.dev/model/entity/storyteller"
	"faryne.dev/service/helper"
)

const (
	personalAccessTokenPrefix    = "sst_"
	personalAccessTokenSecretLen = 32
	personalAccessTokenMaxDays   = 365
)

var errPersonalAccessTokenInvalid = errors.New("personal access token is invalid or expired")

func generatePersonalAccessTokenSecret() (string, error) {
	buf := make([]byte, personalAccessTokenSecretLen)
	if _, err := rand.Read(buf); err != nil {
		return "", err
	}
	return personalAccessTokenPrefix + hex.EncodeToString(buf), nil
}

func (s *Service) PersonalAccessTokens(userID uint64) ([]storytellerModel.PersonalAccessTokenOutput, error) {
	rows, err := s.repo.PersonalAccessTokens(userID)
	if err != nil {
		return nil, err
	}
	output := make([]storytellerModel.PersonalAccessTokenOutput, 0, len(rows))
	for _, row := range rows {
		output = append(output, personalAccessTokenOutput(row))
	}
	return output, nil
}

func (s *Service) CreatePersonalAccessToken(userID uint64, input storytellerModel.PersonalAccessTokenRequest) (*storytellerModel.PersonalAccessTokenCreateOutput, error) {
	label := strings.TrimSpace(input.Label)
	if label == "" {
		return nil, errors.New("token 名稱不可空白")
	}
	token, err := generatePersonalAccessTokenSecret()
	if err != nil {
		return nil, err
	}
	row := &storytellerModel.PersonalAccessToken{
		UserID:      userID,
		Label:       label,
		TokenHash:   helper.SHA256Hex(token),
		TokenPrefix: token[:len(personalAccessTokenPrefix)+6],
	}
	if input.ExpiresInDays != nil {
		days := *input.ExpiresInDays
		if days <= 0 || days > personalAccessTokenMaxDays {
			return nil, errors.New("expires_in_days 必須介於 1 到 365 之間")
		}
		expiresAt := time.Now().AddDate(0, 0, days)
		row.ExpiresAt = &expiresAt
	}
	if err := s.repo.CreatePersonalAccessToken(row); err != nil {
		return nil, err
	}
	return &storytellerModel.PersonalAccessTokenCreateOutput{
		PersonalAccessTokenOutput: personalAccessTokenOutput(*row),
		Token:                     token,
	}, nil
}

func (s *Service) DeletePersonalAccessToken(userID, id uint64) error {
	row, err := s.repo.PersonalAccessTokenByID(userID, id)
	if err != nil {
		return err
	}
	return s.repo.DeletePersonalAccessToken(row)
}

// AuthenticatePersonalAccessToken 驗證明碼 token 並回傳所屬 userID 與這把 token 的
// label，供 MCP 等外部呼叫端使用；label 用來在編輯歷史標記「透過哪把 token 寫入」。
// 驗證通過會非同步更新 last_used_at，不影響回應時間。
func (s *Service) AuthenticatePersonalAccessToken(token string) (userID uint64, label string, err error) {
	token = strings.TrimSpace(token)
	if token == "" {
		return 0, "", errPersonalAccessTokenInvalid
	}
	row, err := s.repo.PersonalAccessTokenByHash(helper.SHA256Hex(token))
	if err != nil {
		return 0, "", errPersonalAccessTokenInvalid
	}
	if row.ExpiresAt != nil && row.ExpiresAt.Before(time.Now()) {
		return 0, "", errPersonalAccessTokenInvalid
	}
	go func(id uint64) {
		_ = s.repo.TouchPersonalAccessTokenLastUsed(id)
	}(row.ID)
	return row.UserID, row.Label, nil
}

func personalAccessTokenOutput(row storytellerModel.PersonalAccessToken) storytellerModel.PersonalAccessTokenOutput {
	return storytellerModel.PersonalAccessTokenOutput{
		ID:          row.ID,
		Label:       row.Label,
		TokenPrefix: row.TokenPrefix,
		LastUsedAt:  row.LastUsedAt,
		ExpiresAt:   row.ExpiresAt,
		CreatedAt:   row.CreatedAt,
	}
}
