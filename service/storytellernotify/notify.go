// Package storytellernotify 是 storyteller 站內通知的唯一寫入與查詢入口：
// 任何功能在業務寫入成功後呼叫 Notify，不用自己處理去重、已讀、鎖定與保留期。
package storytellernotify

import (
	"crypto/rand"
	"encoding/hex"
	"errors"
	"strings"
	"time"

	"faryne.dev/config"
	storytellerModel "faryne.dev/model/entity/storyteller"
	storytellerRepo "faryne.dev/repository/storyteller"
)

var (
	ErrLockLimitReached = errors.New("notification lock limit reached")
	errEmptyGroupKey    = errors.New("notification group_key is required")
	errEmptyText        = errors.New("notification title and body are required")
)

// Input 是一則要送出的通知；GroupKey 是冪等鍵，同一收件人同一 key 只會有一筆。
type Input struct {
	UserID    uint64
	Kind      storytellerModel.NotificationKind
	GroupKey  string
	ProjectID *uint64
	Payload   storytellerModel.NotificationPayload
}

type repository interface {
	InsertNotifications(rows []*storytellerModel.Notification) error
	Notifications(userID uint64, filter storytellerModel.NotificationFilter, cursorPublicID string, limit int) ([]storytellerModel.Notification, error)
	Notification(userID uint64, publicID string) (*storytellerModel.Notification, error)
	NotificationCounts(userID uint64) (int64, int64, error)
	UnreadNotificationCount(userID uint64) (int64, error)
	MarkNotificationRead(userID uint64, publicID string) error
	MarkAllNotificationsRead(userID uint64) (int64, error)
	LockNotification(id, userID uint64, limit int) (bool, error)
	UnlockNotification(id uint64) error
	SoftDeleteNotification(id uint64) error
	PurgeExpiredNotifications(before time.Time, batch int) (int64, error)
}

type Service struct {
	repo      repository
	lockLimit int
	now       func() time.Time
}

func NewService() *Service {
	return &Service{repo: storytellerRepo.NewRepository(), lockLimit: config.EnvConfig().StorytellerNotificationLockLimit, now: time.Now}
}

// NewRows 把 Input 轉成待寫入的資料列；給需要跟業務寫入放在同一個交易的呼叫端（例如發佈掃描）用。
func NewRows(inputs []Input) ([]*storytellerModel.Notification, error) {
	rows := make([]*storytellerModel.Notification, 0, len(inputs))
	for _, input := range inputs {
		if input.GroupKey == "" {
			return nil, errEmptyGroupKey
		}
		if strings.TrimSpace(input.Payload.Title) == "" || strings.TrimSpace(input.Payload.Body) == "" {
			return nil, errEmptyText
		}
		publicID, err := newPublicID()
		if err != nil {
			return nil, err
		}
		rows = append(rows, &storytellerModel.Notification{
			PublicID: publicID, UserID: input.UserID, Kind: input.Kind, GroupKey: input.GroupKey,
			ProjectID: input.ProjectID, Payload: input.Payload, CreatedAt: time.Now(),
		})
	}
	return rows, nil
}

// Notify 只能在業務寫入成功後呼叫；以 group_key 冪等，重送安全。
func (s *Service) Notify(inputs []Input) error {
	rows, err := NewRows(inputs)
	if err != nil {
		return err
	}
	return s.repo.InsertNotifications(rows)
}

func newPublicID() (string, error) {
	buf := make([]byte, 10)
	if _, err := rand.Read(buf); err != nil {
		return "", err
	}
	return "ntf_" + hex.EncodeToString(buf), nil
}
