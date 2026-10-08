package storyteller

import (
	"time"

	storytellerModel "faryne.dev/model/entity/storyteller"
)

// 專案討論版的討論串。回覆在 storyteller_comments（target_type = discussion_thread）。

func (r *Repository) CreateDiscussionThread(row *storytellerModel.DiscussionThread) error {
	return r.db.Create(row).Error
}

// DiscussionThreadByPublicID 只回未刪除的串。
func (r *Repository) DiscussionThreadByPublicID(publicID string) (*storytellerModel.DiscussionThread, error) {
	var row storytellerModel.DiscussionThread
	err := r.db.Where("public_id = ? AND is_deleted = 0", publicID).First(&row).Error
	return &row, err
}

func (r *Repository) DiscussionThreadByID(id uint64) (*storytellerModel.DiscussionThread, error) {
	var row storytellerModel.DiscussionThread
	err := r.db.Where("id = ? AND is_deleted = 0", id).First(&row).Error
	return &row, err
}

// DiscussionThreads 是討論板列表：依篩選或指定錨點；sort＝newest 依發起時間，其餘依最新回覆。
func (r *Repository) DiscussionThreads(projectID uint64, filter storytellerModel.DiscussionListFilter, anchorType storytellerModel.DiscussionAnchorType, anchorID uint64, sort string, offset, limit int) ([]storytellerModel.DiscussionThread, int64, error) {
	q := r.db.Model(&storytellerModel.DiscussionThread{}).Where("project_id = ? AND is_deleted = 0", projectID)
	switch {
	case anchorType != storytellerModel.DiscussionAnchorNone:
		q = q.Where("anchor_type = ? AND anchor_id = ?", anchorType, anchorID)
	case filter == storytellerModel.DiscussionFilterGeneral:
		q = q.Where("anchor_type = ''")
	case filter == storytellerModel.DiscussionFilterStory || filter == storytellerModel.DiscussionFilterLore:
		q = q.Where("anchor_type = ?", filter)
	}
	var total int64
	if err := q.Count(&total).Error; err != nil {
		return nil, 0, err
	}
	order := "last_activity_at DESC, id DESC"
	if sort == "newest" {
		order = "id DESC"
	}
	rows := make([]storytellerModel.DiscussionThread, 0, limit)
	err := q.Order(order).Offset(offset).Limit(limit).Find(&rows).Error
	return rows, total, err
}

// 時間一律由 Go 帶入（time.Now()），不用 MySQL 的 NOW()：連線時區與 DB 時區不同，混用會差 8 小時、排序錯亂。

// UpdateDiscussionThread 編輯標題與內文：舊版本先附加進 edit_history（單表 UPDATE 由左到右賦值，讀到的是舊值）。
func (r *Repository) UpdateDiscussionThread(id uint64, title, body string) error {
	return r.db.Exec(`UPDATE storyteller_discussion_threads SET
		edit_history = JSON_ARRAY_APPEND(COALESCE(edit_history, JSON_ARRAY()), '$', JSON_OBJECT('title', title, 'body', body, 'edited_at', COALESCE(edited_at, created_at))),
		title = ?, body = ?, edited_at = ?
		WHERE id = ? AND is_deleted = 0`, title, body, time.Now(), id).Error
}

func (r *Repository) SoftDeleteDiscussionThread(id uint64) error {
	return r.db.Model(&storytellerModel.DiscussionThread{}).Where("id = ?", id).
		Updates(map[string]any{"is_deleted": true, "deleted_at": time.Now()}).Error
}

func (r *Repository) SetDiscussionThreadLocked(id uint64, locked bool) error {
	value := any(nil)
	if locked {
		value = time.Now()
	}
	return r.db.Model(&storytellerModel.DiscussionThread{}).Where("id = ?", id).UpdateColumn("locked_at", value).Error
}

// TouchDiscussionThread 有新回覆時更新「最新回覆」排序；不動 updated_at 以外的欄位。
func (r *Repository) TouchDiscussionThread(id uint64) error {
	return r.db.Model(&storytellerModel.DiscussionThread{}).Where("id = ?", id).UpdateColumn("last_activity_at", time.Now()).Error
}

// ---- 錨點 ----

// ProjectByPublicIDAny 不限可見度（只排除已刪除），由 service 依可見度與分享 token 判斷能不能進討論版。
func (r *Repository) ProjectByPublicIDAny(publicID string) (*storytellerModel.Project, error) {
	var row storytellerModel.Project
	err := r.db.Where("public_id = ? AND deleted_at IS NULL", publicID).First(&row).Error
	return &row, err
}

// ProjectStoryRef 是作品裡對讀者可見的一話（已完成、所在冊也已完成、未刪除）。
type ProjectStoryRef struct {
	ID          uint64
	PublicID    string
	Title       string
	VolumeTitle string
}

// VisibleStoryRefs 依 id 或 public_id 查作品裡對讀者可見的話；兩個都空就回空。
func (r *Repository) VisibleStoryRefs(projectID uint64, ids []uint64, publicIDs []string) ([]ProjectStoryRef, error) {
	rows := make([]ProjectStoryRef, 0)
	if len(ids) == 0 && len(publicIDs) == 0 {
		return rows, nil
	}
	q := r.db.Table("storyteller_stories AS stories").
		Joins("LEFT JOIN storyteller_stories AS parent ON parent.id = stories.parent_id").
		Where("stories.project_id = ? AND stories.is_volume = 0 AND stories.is_deleted = 0 AND stories.deleted_at IS NULL AND stories.status = ?", projectID, storytellerModel.StoryStatusCompleted).
		Where("stories.parent_id IS NULL OR parent.status = ?", storytellerModel.StoryStatusCompleted)
	if len(ids) > 0 {
		q = q.Where("stories.id IN ?", ids)
	} else {
		q = q.Where("stories.public_id IN ?", publicIDs)
	}
	err := q.Select("stories.id, stories.public_id, stories.title, COALESCE(parent.title, '') AS volume_title").Scan(&rows).Error
	return rows, err
}

// ProjectLoreRef 是作品裡已公開的一篇設定。
type ProjectLoreRef struct {
	ID       uint64
	PublicID string
	Title    string
}

func (r *Repository) VisibleLoreRefs(projectID uint64, ids []uint64, publicIDs []string) ([]ProjectLoreRef, error) {
	rows := make([]ProjectLoreRef, 0)
	if len(ids) == 0 && len(publicIDs) == 0 {
		return rows, nil
	}
	q := r.db.Model(&storytellerModel.Lore{}).
		Where("project_id = ? AND is_deleted = 0 AND deleted_at IS NULL AND status = ?", projectID, storytellerModel.StoryStatusCompleted)
	if len(ids) > 0 {
		q = q.Where("id IN ?", ids)
	} else {
		q = q.Where("public_id IN ?", publicIDs)
	}
	err := q.Select("id, public_id, title").Scan(&rows).Error
	return rows, err
}
