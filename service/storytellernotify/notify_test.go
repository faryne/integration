package storytellernotify

import (
	"testing"
	"time"

	storytellerModel "faryne.dev/model/entity/storyteller"
	"github.com/stretchr/testify/require"
	"gorm.io/gorm"
)

// fakeRepo 只實作測試用得到的行為；鎖定上限用 locked 計數模擬條件式 UPDATE。
type fakeRepo struct {
	rows     []*storytellerModel.Notification
	inserted []*storytellerModel.Notification
	purgedAt time.Time
}

func (f *fakeRepo) InsertNotifications(rows []*storytellerModel.Notification) error {
	f.inserted = append(f.inserted, rows...)
	return nil
}

func (f *fakeRepo) Notifications(userID uint64, filter storytellerModel.NotificationFilter, _ string, limit int) ([]storytellerModel.Notification, error) {
	out := make([]storytellerModel.Notification, 0)
	for _, row := range f.rows {
		if row.UserID == userID && !row.IsDeleted && len(out) < limit {
			out = append(out, *row)
		}
	}
	return out, nil
}

func (f *fakeRepo) Notification(userID uint64, publicID string) (*storytellerModel.Notification, error) {
	for _, row := range f.rows {
		if row.UserID == userID && row.PublicID == publicID && !row.IsDeleted {
			copied := *row
			return &copied, nil
		}
	}
	return nil, gorm.ErrRecordNotFound
}

func (f *fakeRepo) NotificationCounts(uint64) (int64, int64, error) { return 0, f.lockedCount(), nil }
func (f *fakeRepo) UnreadNotificationCount(uint64) (int64, error)   { return 0, nil }
func (f *fakeRepo) MarkNotificationRead(uint64, string) error       { return nil }
func (f *fakeRepo) MarkAllNotificationsRead(uint64) (int64, error)  { return 0, nil }

func (f *fakeRepo) lockedCount() int64 {
	var n int64
	for _, row := range f.rows {
		if row.LockedAt != nil && !row.IsDeleted {
			n++
		}
	}
	return n
}

func (f *fakeRepo) LockNotification(id, _ uint64, limit int) (bool, error) {
	if f.lockedCount() >= int64(limit) {
		return false, nil
	}
	now := time.Now()
	f.byID(id).LockedAt = &now
	return true, nil
}

func (f *fakeRepo) UnlockNotification(id uint64) error {
	f.byID(id).LockedAt = nil
	return nil
}

func (f *fakeRepo) SoftDeleteNotification(id uint64) error {
	row := f.byID(id)
	row.IsDeleted, row.LockedAt = true, nil
	return nil
}

func (f *fakeRepo) PurgeExpiredNotifications(before time.Time, _ int) (int64, error) {
	f.purgedAt = before
	return 0, nil
}

func (f *fakeRepo) byID(id uint64) *storytellerModel.Notification {
	for _, row := range f.rows {
		if row.ID == id {
			return row
		}
	}
	return nil
}

func newTestService(rows ...*storytellerModel.Notification) (*Service, *fakeRepo) {
	repo := &fakeRepo{rows: rows}
	return &Service{repo: repo, lockLimit: 2, now: time.Now}, repo
}

func row(id uint64, publicID string, locked bool) *storytellerModel.Notification {
	r := &storytellerModel.Notification{ID: id, PublicID: publicID, UserID: 1, CreatedAt: time.Date(2026, 10, 1, 0, 0, 0, 0, time.UTC)}
	if locked {
		now := time.Now()
		r.LockedAt = &now
	}
	return r
}

func TestNotifyRequiresGroupKeyAndAssignsPublicID(t *testing.T) {
	s, repo := newTestService()
	require.Error(t, s.Notify([]Input{{UserID: 1, Kind: storytellerModel.NotificationKindPATCreated}}))
	require.NoError(t, s.Notify([]Input{{UserID: 1, Kind: storytellerModel.NotificationKindPATCreated, GroupKey: "k"}}))
	require.Len(t, repo.inserted, 1)
	require.Regexp(t, `^ntf_[0-9a-f]{20}$`, repo.inserted[0].PublicID)
}

func TestOutputExpiresAfterRetentionUnlessLocked(t *testing.T) {
	s, _ := newTestService()
	out := s.output(*row(1, "a", false))
	require.Equal(t, time.Date(2027, 3, 30, 0, 0, 0, 0, time.UTC), *out.ExpiresAt)
	require.Nil(t, s.output(*row(2, "b", true)).ExpiresAt)
}

func TestLockRespectsLimitAndIsIdempotent(t *testing.T) {
	s, _ := newTestService(row(1, "a", true), row(2, "b", false), row(3, "c", false))
	// 已鎖定的再鎖一次不算新的鎖定
	out, err := s.Lock(1, "a")
	require.NoError(t, err)
	require.True(t, out.Locked)

	_, err = s.Lock(1, "b")
	require.NoError(t, err)
	_, err = s.Lock(1, "c")
	require.ErrorIs(t, err, ErrLockLimitReached)

	// 刪除會釋放鎖定名額
	require.NoError(t, s.Delete(1, "a"))
	_, err = s.Lock(1, "c")
	require.NoError(t, err)
}

func TestOtherUsersNotificationIsNotFound(t *testing.T) {
	s, _ := newTestService(row(1, "a", false))
	_, err := s.Get(2, "a")
	require.ErrorIs(t, err, gorm.ErrRecordNotFound)
	require.ErrorIs(t, s.Delete(2, "a"), gorm.ErrRecordNotFound)
}

func TestListPaginatesWithCursor(t *testing.T) {
	rows := make([]*storytellerModel.Notification, 0, pageSize+1)
	for i := range pageSize + 1 {
		rows = append(rows, row(uint64(i+1), string(rune('a'+i)), false))
	}
	s, _ := newTestService(rows...)
	out, err := s.List(1, "bogus", "")
	require.NoError(t, err)
	require.Len(t, out.Items, pageSize)
	require.Equal(t, out.Items[pageSize-1].PublicID, out.NextCursor)
	require.Equal(t, 2, out.LockLimit)
}

func TestPurgeUsesRetentionWindow(t *testing.T) {
	s, repo := newTestService()
	now := time.Date(2026, 10, 1, 4, 25, 0, 0, time.UTC)
	s.now = func() time.Time { return now }
	_, err := s.Purge()
	require.NoError(t, err)
	require.Equal(t, now.AddDate(0, 0, -storytellerModel.NotificationRetentionDays), repo.purgedAt)
}
