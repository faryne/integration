package storytelleroauth

import (
	"errors"

	storytellerModel "faryne.dev/model/entity/storyteller"
	"faryne.dev/repository"
	"faryne.dev/service/helper"
	"faryne.dev/service/log"
	"go.uber.org/zap"
)

var errAccessTokenInvalid = errors.New("oauth access token is invalid or expired")

// Authentication 跟 PAT 的驗證結果同形狀：只帶 middleware 需要的公開識別資料。
type Authentication struct {
	UserID        uint64
	Label         string
	CredentialRef string
	DeniedReason  string
}

// Authenticate 驗證 MCP 等 resource 收到的 access token；通過會非同步更新 last_used_at。
func (s *Service) Authenticate(token string) (*Authentication, error) {
	grant, err := s.repo.OAuthGrantByAccessHash(helper.SHA256Hex(token))
	if err != nil {
		return nil, errAccessTokenInvalid
	}
	result := &Authentication{
		UserID: grant.UserID, Label: displayName(grant.ClientName, grant.RedirectURIs), CredentialRef: grant.PublicID,
	}
	if grant.AccessExpiresAt.Before(s.now()) {
		result.DeniedReason = "expired"
		return result, errAccessTokenInvalid
	}
	go func(id uint64) {
		_ = s.repo.TouchOAuthGrantLastUsed(id)
	}(grant.ID)
	return result, nil
}

func (s *Service) Grants(userID uint64) ([]storytellerModel.OAuthGrantOutput, error) {
	rows, err := s.repo.OAuthGrants(userID)
	if err != nil {
		return nil, err
	}
	output := make([]storytellerModel.OAuthGrantOutput, 0, len(rows))
	for _, row := range rows {
		output = append(output, grantOutput(row))
	}
	return output, nil
}

// RevokeGrant 是使用者在「開發者 › OAuth Token」頁按下撤銷；soft delete 後 token 立即失效。
func (s *Service) RevokeGrant(userID uint64, publicID string) (*storytellerModel.OAuthGrantOutput, error) {
	row, err := s.repo.OAuthGrantByPublicID(userID, publicID)
	if err != nil {
		return nil, err
	}
	if err := s.repo.DeleteOAuthGrant(row.ID); err != nil {
		return nil, err
	}
	output := grantOutput(*row)
	return &output, nil
}

func grantOutput(row storytellerModel.OAuthGrantWithClient) storytellerModel.OAuthGrantOutput {
	host := ""
	if uris := clientRedirectURIs(row.RedirectURIs); len(uris) > 0 {
		host = redirectHost(uris[0])
	}
	return storytellerModel.OAuthGrantOutput{
		PublicID: row.PublicID, ClientName: displayName(row.ClientName, row.RedirectURIs), RedirectHost: host,
		LastUsedAt: row.LastUsedAt, RefreshExpiresAt: row.RefreshExpiresAt, CreatedAt: row.CreatedAt,
	}
}

// RunCleanupUnusedClients 給 cron 用：清掉註冊超過 7 天仍沒產生 grant 的 DCR client。
func RunCleanupUnusedClients() {
	s := NewService()
	deleted, err := s.repo.DeleteUnusedOAuthClients(s.now().Add(-unusedClientTTL))
	if err != nil {
		log.Logger().Error("Cleanup unused storyteller OAuth clients failed", zap.Error(err))
		return
	}
	log.Logger().Info("Cleanup unused storyteller OAuth clients", zap.Int64("deleted", deleted))
}

// IsNotFound 讓 controller 不用直接依賴 repository 判斷 404。
func IsNotFound(err error) bool { return repository.IsRecordNotFound(err) }
