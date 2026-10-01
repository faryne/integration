package storyteller

import (
	"crypto/rand"
	"encoding/hex"
	"errors"
	"strings"
	"time"

	storytellerModel "faryne.dev/model/entity/storyteller"
	"faryne.dev/service/helper"
	notifyService "faryne.dev/service/storytellernotify"
)

const (
	personalAccessTokenPrefix    = "sst_"
	personalAccessTokenSecretLen = 32
	personalAccessTokenMaxDays   = 365
)

var errPersonalAccessTokenInvalid = errors.New("personal access token is invalid or expired")

// PersonalAccessTokenAuthentication 只帶 middleware 需要的公開識別資料，不含 token 或 hash。
type PersonalAccessTokenAuthentication struct {
	UserID        uint64
	Label         string
	CredentialRef string
	DeniedReason  string
}

type personalAccessTokenAuthRepository interface {
	PersonalAccessTokenByHash(string) (*storytellerModel.PersonalAccessToken, error)
	TouchPersonalAccessTokenLastUsed(uint64) error
}

func generatePersonalAccessTokenSecret() (string, error) {
	buf := make([]byte, personalAccessTokenSecretLen)
	if _, err := rand.Read(buf); err != nil {
		return "", err
	}
	return personalAccessTokenPrefix + hex.EncodeToString(buf), nil
}

func generatePersonalAccessTokenPublicID() (string, error) {
	publicID := randomID()
	if publicID == "" {
		return "", errors.New("failed to generate personal access token public id")
	}
	return "pat_" + publicID, nil
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

// CreatePersonalAccessToken 建立後會發一則安全通知給帳號本人；origin 是建立當下的請求來源。
func (s *Service) CreatePersonalAccessToken(userID uint64, input storytellerModel.PersonalAccessTokenRequest, origin notifyService.Origin) (*storytellerModel.PersonalAccessTokenCreateOutput, error) {
	label := strings.TrimSpace(input.Label)
	if label == "" {
		return nil, errors.New("token 名稱不可空白")
	}
	token, err := generatePersonalAccessTokenSecret()
	if err != nil {
		return nil, err
	}
	publicID, err := generatePersonalAccessTokenPublicID()
	if err != nil {
		return nil, err
	}
	tokenHash := helper.SHA256Hex(token)
	row := &storytellerModel.PersonalAccessToken{
		PublicID:    publicID,
		UserID:      userID,
		Label:       label,
		TokenHash:   tokenHash,
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
	notifyService.NewService().NotifyPATCreated(userID, row.PublicID, row.Label, row.TokenPrefix, row.ExpiresAt, origin)
	return &storytellerModel.PersonalAccessTokenCreateOutput{
		PersonalAccessTokenOutput: personalAccessTokenOutput(*row),
		Token:                     token,
	}, nil
}

func (s *Service) DeletePersonalAccessToken(userID, id uint64) (*storytellerModel.PersonalAccessTokenOutput, error) {
	row, err := s.repo.PersonalAccessTokenByID(userID, id)
	if err != nil {
		return nil, err
	}
	if err := s.repo.DeletePersonalAccessToken(row); err != nil {
		return nil, err
	}
	output := personalAccessTokenOutput(*row)
	return &output, nil
}

// AuthenticatePersonalAccessToken 驗證明碼 token 並回傳所屬 userID、label 與可公開的
// credential ref；label 用來在編輯歷史標記「透過哪把 token 寫入」。
// 驗證通過會非同步更新 last_used_at，不影響回應時間。
func (s *Service) AuthenticatePersonalAccessToken(token string) (*PersonalAccessTokenAuthentication, error) {
	return authenticatePersonalAccessToken(s.repo, token, time.Now())
}

func authenticatePersonalAccessToken(repo personalAccessTokenAuthRepository, token string, now time.Time) (*PersonalAccessTokenAuthentication, error) {
	token = strings.TrimSpace(token)
	if token == "" {
		return nil, errPersonalAccessTokenInvalid
	}
	row, err := repo.PersonalAccessTokenByHash(helper.SHA256Hex(token))
	if err != nil {
		return nil, errPersonalAccessTokenInvalid
	}
	result := &PersonalAccessTokenAuthentication{UserID: row.UserID, Label: row.Label, CredentialRef: row.PublicID}
	if row.ExpiresAt != nil && row.ExpiresAt.Before(now) {
		result.DeniedReason = "expired"
		return result, errPersonalAccessTokenInvalid
	}
	go func(id uint64) {
		_ = repo.TouchPersonalAccessTokenLastUsed(id)
	}(row.ID)
	return result, nil
}

func personalAccessTokenOutput(row storytellerModel.PersonalAccessToken) storytellerModel.PersonalAccessTokenOutput {
	return storytellerModel.PersonalAccessTokenOutput{
		ID:          row.ID,
		PublicID:    row.PublicID,
		Label:       row.Label,
		TokenPrefix: row.TokenPrefix,
		LastUsedAt:  row.LastUsedAt,
		ExpiresAt:   row.ExpiresAt,
		CreatedAt:   row.CreatedAt,
	}
}
