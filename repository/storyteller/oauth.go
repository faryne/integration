package storyteller

import (
	"time"

	storytellerModel "faryne.dev/model/entity/storyteller"
	"gorm.io/gorm"
)

// oauthGrantSelect 把 grant 跟 client 顯示資訊一起撈出來；bearer 驗證也走這個 join，
// 順便排除已刪除的 storyteller 帳號，刪帳號後 token 自然失效。
const oauthGrantSelect = "g.*, c.client_id, c.client_name, c.redirect_uris"

func (r *Repository) oauthGrantQuery() *gorm.DB {
	return r.db.Table("storyteller_oauth_grants AS g").
		Select(oauthGrantSelect).
		Joins("JOIN storyteller_oauth_clients AS c ON c.id = g.oauth_client_id").
		Joins("JOIN storyteller_users AS u ON u.id = g.user_id AND u.deleted_at IS NULL").
		Where("g.is_deleted = 0")
}

func (r *Repository) CreateOAuthClient(row *storytellerModel.OAuthClient) error {
	return r.db.Create(row).Error
}

func (r *Repository) OAuthClientByClientID(clientID string) (*storytellerModel.OAuthClient, error) {
	var row storytellerModel.OAuthClient
	err := r.db.Where("client_id = ?", clientID).First(&row).Error
	return &row, err
}

// DeleteUnusedOAuthClients 清掉註冊超過 before、而且從來沒產生過 grant 的匿名 client；
// DCR 是公開端點，這些只是沒完成授權的註冊殘留，不是使用者資料，直接硬刪除。
func (r *Repository) DeleteUnusedOAuthClients(before time.Time) (int64, error) {
	result := r.db.Where("created_at < ? AND NOT EXISTS (SELECT 1 FROM storyteller_oauth_grants g WHERE g.oauth_client_id = storyteller_oauth_clients.id)", before).
		Delete(&storytellerModel.OAuthClient{})
	return result.RowsAffected, result.Error
}

func (r *Repository) CreateOAuthGrant(row *storytellerModel.OAuthGrant) error {
	return r.db.Create(row).Error
}

func (r *Repository) OAuthGrants(userID uint64) ([]storytellerModel.OAuthGrantWithClient, error) {
	rows := make([]storytellerModel.OAuthGrantWithClient, 0)
	err := r.oauthGrantQuery().Where("g.user_id = ?", userID).
		Order("g.created_at DESC, g.id DESC").
		Find(&rows).Error
	return rows, err
}

func (r *Repository) OAuthGrantByPublicID(userID uint64, publicID string) (*storytellerModel.OAuthGrantWithClient, error) {
	var row storytellerModel.OAuthGrantWithClient
	err := r.oauthGrantQuery().Where("g.user_id = ? AND g.public_id = ?", userID, publicID).Take(&row).Error
	return &row, err
}

func (r *Repository) OAuthGrantByAccessHash(tokenHash string) (*storytellerModel.OAuthGrantWithClient, error) {
	var row storytellerModel.OAuthGrantWithClient
	err := r.oauthGrantQuery().Where("g.access_token_hash = ?", tokenHash).Take(&row).Error
	return &row, err
}

func (r *Repository) OAuthGrantByRefreshHash(tokenHash string) (*storytellerModel.OAuthGrantWithClient, error) {
	var row storytellerModel.OAuthGrantWithClient
	err := r.oauthGrantQuery().Where("g.refresh_token_hash = ?", tokenHash).Take(&row).Error
	return &row, err
}

// RotateOAuthGrantTokens 以舊 refresh hash 當條件更新，同一個 refresh token 併發換兩次時
// 只有一次會成功（rows affected = 1），另一次回 false 交給 service 當 invalid_grant。
func (r *Repository) RotateOAuthGrantTokens(id uint64, oldRefreshHash string, next storytellerModel.OAuthGrant) (bool, error) {
	result := r.db.Model(&storytellerModel.OAuthGrant{}).
		Where("id = ? AND refresh_token_hash = ? AND is_deleted = 0", id, oldRefreshHash).
		Updates(map[string]any{
			"access_token_hash":  next.AccessTokenHash,
			"access_expires_at":  next.AccessExpiresAt,
			"refresh_token_hash": next.RefreshTokenHash,
			"refresh_expires_at": next.RefreshExpiresAt,
		})
	return result.RowsAffected == 1, result.Error
}

func (r *Repository) DeleteOAuthGrant(id uint64) error {
	return r.db.Model(&storytellerModel.OAuthGrant{}).
		Where("id = ? AND is_deleted = 0", id).
		Updates(map[string]any{"is_deleted": true, "deleted_at": time.Now()}).Error
}

func (r *Repository) TouchOAuthGrantLastUsed(id uint64) error {
	return r.db.Model(&storytellerModel.OAuthGrant{}).
		Where("id = ?", id).
		Update("last_used_at", time.Now()).Error
}
