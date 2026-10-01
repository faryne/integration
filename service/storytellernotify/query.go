package storytellernotify

import (
	storytellerModel "faryne.dev/model/entity/storyteller"
)

// pageSize 是通知頁每次載入的筆數（popover 也用同一支 API，只取前 10 則顯示）。
const pageSize = 20

func (s *Service) output(row storytellerModel.Notification) storytellerModel.NotificationOutput {
	out := storytellerModel.NotificationOutput{
		PublicID: row.PublicID, Kind: row.Kind, Payload: row.Payload,
		Read: row.ReadAt != nil, Locked: row.LockedAt != nil, CreatedAt: row.CreatedAt,
	}
	// 已鎖定的不會被清除，ExpiresAt 留 nil
	if row.LockedAt == nil {
		expires := row.CreatedAt.AddDate(0, 0, storytellerModel.NotificationRetentionDays)
		out.ExpiresAt = &expires
	}
	return out
}

func (s *Service) List(userID uint64, filter storytellerModel.NotificationFilter, cursor string) (*storytellerModel.NotificationListOutput, error) {
	switch filter {
	case storytellerModel.NotificationFilterUnread, storytellerModel.NotificationFilterLocked:
	default:
		filter = storytellerModel.NotificationFilterAll
	}
	// 多撈一筆判斷還有沒有下一頁
	rows, err := s.repo.Notifications(userID, filter, cursor, pageSize+1)
	if err != nil {
		return nil, err
	}
	unread, locked, err := s.repo.NotificationCounts(userID)
	if err != nil {
		return nil, err
	}
	out := &storytellerModel.NotificationListOutput{
		Items: make([]storytellerModel.NotificationOutput, 0, len(rows)), UnreadCount: unread, LockedCount: locked, LockLimit: s.lockLimit,
	}
	if len(rows) > pageSize {
		rows = rows[:pageSize]
		out.NextCursor = rows[pageSize-1].PublicID
	}
	for _, row := range rows {
		out.Items = append(out.Items, s.output(row))
	}
	return out, nil
}

// Kinds 回傳通知類型註冊表（文字、分類、呈現方式），前端據此顯示，不寫死 kind。
func (s *Service) Kinds() []storytellerModel.NotificationKindDefinition {
	return storytellerModel.NotificationKinds
}

func (s *Service) Get(userID uint64, publicID string) (*storytellerModel.NotificationOutput, error) {
	row, err := s.repo.Notification(userID, publicID)
	if err != nil {
		return nil, err
	}
	out := s.output(*row)
	return &out, nil
}

func (s *Service) UnreadCount(userID uint64) (int64, error) {
	return s.repo.UnreadNotificationCount(userID)
}

// MarkRead 是打開內容頁時呼叫；已讀過的不會改掉第一次讀的時間。
func (s *Service) MarkRead(userID uint64, publicID string) error {
	if _, err := s.repo.Notification(userID, publicID); err != nil {
		return err
	}
	return s.repo.MarkNotificationRead(userID, publicID)
}

func (s *Service) MarkAllRead(userID uint64) (int64, error) {
	return s.repo.MarkAllNotificationsRead(userID)
}

// Lock 鎖定後不會被保留期清除；已鎖定的再鎖一次視為成功，達上限回 ErrLockLimitReached。
func (s *Service) Lock(userID uint64, publicID string) (*storytellerModel.NotificationOutput, error) {
	row, err := s.repo.Notification(userID, publicID)
	if err != nil {
		return nil, err
	}
	if row.LockedAt == nil {
		ok, err := s.repo.LockNotification(row.ID, userID, s.lockLimit)
		if err != nil {
			return nil, err
		}
		if !ok {
			return nil, ErrLockLimitReached
		}
		now := s.now()
		row.LockedAt = &now
	}
	out := s.output(*row)
	return &out, nil
}

func (s *Service) Unlock(userID uint64, publicID string) (*storytellerModel.NotificationOutput, error) {
	row, err := s.repo.Notification(userID, publicID)
	if err != nil {
		return nil, err
	}
	if row.LockedAt != nil {
		if err := s.repo.UnlockNotification(row.ID); err != nil {
			return nil, err
		}
		row.LockedAt = nil
	}
	out := s.output(*row)
	return &out, nil
}

func (s *Service) Delete(userID uint64, publicID string) error {
	row, err := s.repo.Notification(userID, publicID)
	if err != nil {
		return err
	}
	return s.repo.SoftDeleteNotification(row.ID)
}

// purgeBatch 是保留期清除每批刪除的筆數。
const purgeBatch = 2000

// Purge 刪除建立超過保留期、且未鎖定的通知（不論是否已讀）。
func (s *Service) Purge() (int64, error) {
	before := s.now().AddDate(0, 0, -storytellerModel.NotificationRetentionDays)
	return s.repo.PurgeExpiredNotifications(before, purgeBatch)
}
