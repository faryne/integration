package storytellernotify

import (
	"context"
	"time"

	storytellerModel "faryne.dev/model/entity/storyteller"
	"faryne.dev/service/log"
	auditService "faryne.dev/service/storytelleraudit"
	"go.uber.org/zap"
)

// Origin 是觸發安全事件的請求來源（入口、IP、User-Agent），取自稽核 request context。
type Origin struct {
	Source    string `json:"source,omitempty"`
	IP        string `json:"ip,omitempty"`
	UserAgent string `json:"user_agent,omitempty"`
}

func OriginFrom(ctx context.Context) Origin {
	value, ok := auditService.RequestContextFrom(ctx)
	if !ok {
		return Origin{}
	}
	return Origin{Source: string(value.Source), IP: value.IP, UserAgent: value.UserAgent}
}

// 安全通知的收件人就是帳號本人，不排除操作者：用意就是「如果不是你做的」。
// 送不出去只記 log，不能讓建立 PAT／授權本身失敗。
func (s *Service) notifySecurity(userID uint64, kind storytellerModel.NotificationKind, credentialPublicID string, payload storytellerModel.NotificationPayload, origin Origin) {
	payload.CredentialPublicID = credentialPublicID
	payload.Source, payload.IP, payload.UserAgent = origin.Source, origin.IP, origin.UserAgent
	if err := s.Notify([]Input{{UserID: userID, Kind: kind, GroupKey: string(kind) + ":" + credentialPublicID, Payload: payload}}); err != nil {
		log.Logger().Error("Storyteller security notification failed", zap.String("kind", string(kind)), zap.Uint64("user_id", userID), zap.Error(err))
	}
}

func (s *Service) NotifyPATCreated(userID uint64, publicID, label, tokenPrefix string, expiresAt *time.Time, origin Origin) {
	s.notifySecurity(userID, storytellerModel.NotificationKindPATCreated, publicID, storytellerModel.NotificationPayload{
		Label: label, TokenPrefix: tokenPrefix, ExpiresAt: expiresAt,
	}, origin)
}

// NotifyOAuthAuthorized 在授權碼換到第一組 token、grant 正式建立時呼叫；origin 是使用者
// 按「允許」當下的瀏覽器來源，不是應用程式呼叫 token 端點的伺服器。
func (s *Service) NotifyOAuthAuthorized(userID uint64, grantPublicID, clientName string, origin Origin) {
	s.notifySecurity(userID, storytellerModel.NotificationKindOAuthAuthorized, grantPublicID, storytellerModel.NotificationPayload{
		ClientName: clientName,
	}, origin)
}
