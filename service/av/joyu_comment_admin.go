package av

import (
	"errors"
	"slices"
	"strings"
	"time"

	avEntity "faryne.dev/model/entity/opendata/av"
	avRepo "faryne.dev/repository/av"
	authService "faryne.dev/service/auth"
)

// joyu 討論版的後台管理（faryne.dev/backend_admin）：列出被檢舉的／最新的留言、管理員刪除、封鎖 uid 或 IP。
// 全部要主站登入且 users.is_admin

const adminCommentPageSize = 30

var ErrBanInvalid = errors.New("封鎖的內容不正確")

// AdminJoyuComments 後台列表；tab 是 reported（被檢舉的）或其他（最新的）
func AdminJoyuComments(adminID uint64, tab string, page int) ([]avEntity.JoyuAdminComment, int64, error) {
	if err := authService.RequireAdmin(adminID); err != nil {
		return nil, 0, err
	}
	repo := avRepo.NewJoyuComment()
	rows, total, err := repo.AdminList(tab, max(page, 1), adminCommentPageSize)
	if err != nil {
		return nil, 0, err
	}
	ids := make([]uint64, 0, len(rows))
	for _, c := range rows {
		ids = append(ids, c.ID)
	}
	reasons, err := repo.ReportReasons(ids)
	if err != nil {
		return nil, 0, err
	}
	users, err := commentUsers(rows)
	if err != nil {
		return nil, 0, err
	}
	out := make([]avEntity.JoyuAdminComment, 0, len(rows))
	for _, c := range rows {
		name, _ := commentAuthorName(c.FirebaseUID, users)
		out = append(out, avEntity.JoyuAdminComment{
			ID: c.ID, TargetType: c.TargetType, TargetKey: c.TargetKey, FirebaseUID: c.FirebaseUID, AuthorName: name,
			IsAnonymous: c.IsAnonymous, Body: c.Body, ParentID: c.ParentID, IP: c.IP, ReportCount: c.ReportCount,
			IsDeleted: c.IsDeleted, CreatedAt: c.CreatedAt, Reasons: reasons[c.ID],
		})
	}
	return out, total, nil
}

// AdminDeleteJoyuComment 管理員刪除留言（前台留「此留言已被管理員刪除」的佔位）
func AdminDeleteJoyuComment(adminID, id uint64) error {
	if err := authService.RequireAdmin(adminID); err != nil {
		return err
	}
	return avRepo.NewJoyuComment().AdminDelete(id, adminID)
}

// AdminJoyuBans 還有效的封鎖名單
func AdminJoyuBans(adminID uint64) ([]avEntity.JoyuBan, error) {
	if err := authService.RequireAdmin(adminID); err != nil {
		return nil, err
	}
	return avRepo.NewJoyuBan().Active()
}

// AdminBanJoyu 封鎖 uid 或 IP；Days 為 0 是永久
func AdminBanJoyu(adminID uint64, req avEntity.JoyuBanRequest) error {
	if err := authService.RequireAdmin(adminID); err != nil {
		return err
	}
	req.Value = strings.TrimSpace(req.Value)
	if !slices.Contains([]string{avEntity.JoyuBanUID, avEntity.JoyuBanIP}, req.BanType) || req.Value == "" || len(req.Value) > 128 || req.Days < 0 {
		return ErrBanInvalid
	}
	now := time.Now()
	b := avEntity.JoyuBan{BanType: req.BanType, Value: req.Value, Reason: strings.TrimSpace(req.Reason), CreatedBy: adminID, CreatedAt: &now}
	if req.Days > 0 {
		exp := now.AddDate(0, 0, req.Days)
		b.ExpiresAt = &exp
	}
	return avRepo.NewJoyuBan().Create(&b)
}

// AdminLiftJoyuBan 解除封鎖
func AdminLiftJoyuBan(adminID, id uint64) error {
	if err := authService.RequireAdmin(adminID); err != nil {
		return err
	}
	return avRepo.NewJoyuBan().Lift(id)
}
