package storyteller

import (
	storytellerModel "faryne.dev/model/entity/storyteller"
)

// AuditEvents 依 keyset（occurred_at DESC, id DESC）分頁查稽核事件，多取一筆讓 service
// 判斷是否還有下一頁。project scope 走 (project_id, occurred_at, id) 索引，account
// scope 走 (actor_user_id, occurred_at, id) 索引，兩者都一定帶時間範圍，避免全表掃描。
func (r *Repository) AuditEvents(q storytellerModel.AuditEventQuery) ([]storytellerModel.AuditEvent, error) {
	query := r.db.Model(&storytellerModel.AuditEvent{}).
		Where("occurred_at >= ? AND occurred_at < ?", q.From, q.To)
	switch q.Scope {
	case storytellerModel.AuditEventScopeProject:
		query = query.Where("project_id = ?", q.ProjectID)
	default:
		// 帳號活動只看本人：帳號層事件（沒有 project）加上所有透過 PAT 的操作，
		// 不把本人在網頁上的日常編輯混進來。
		query = query.Where("actor_user_id = ? AND (project_id IS NULL OR auth_method = ?)", q.UserID, storytellerModel.AuditAuthMethodPAT)
	}
	if q.ActorSelf {
		query = query.Where("actor_user_id = ?", q.UserID)
	} else if q.ActorSystem {
		query = query.Where("actor_type = ?", storytellerModel.AuditActorTypeSystem)
	}
	if len(q.Actions) > 0 {
		query = query.Where("action IN ?", q.Actions)
	}
	if len(q.ExcludeActions) > 0 {
		query = query.Where("action NOT IN ?", q.ExcludeActions)
	}
	if q.Source != "" {
		query = query.Where("source = ?", q.Source)
	}
	if q.Outcome != "" {
		query = query.Where("outcome = ?", q.Outcome)
	}
	if q.CredentialRef != "" {
		query = query.Where("credential_ref = ?", q.CredentialRef)
	}
	if q.CursorAt != nil {
		query = query.Where("(occurred_at < ? OR (occurred_at = ? AND id < ?))", *q.CursorAt, *q.CursorAt, q.CursorID)
	}
	rows := make([]storytellerModel.AuditEvent, 0, q.Limit+1)
	err := query.Order("occurred_at DESC, id DESC").Limit(q.Limit + 1).Find(&rows).Error
	return rows, err
}

// AuditUserDisplayNames 把事件上的 actor_user_id 轉成顯示名稱（筆名優先）。
func (r *Repository) AuditUserDisplayNames(userIDs []uint64) (map[uint64]string, error) {
	names := make(map[uint64]string, len(userIDs))
	if len(userIDs) == 0 {
		return names, nil
	}
	rows := make([]struct {
		UserID uint64
		Name   string
	}, 0, len(userIDs))
	// storyteller 使用者系統已跟主站脫鉤，session 與稽核事件上的 user id 對應的是
	// storyteller_users.id；user_id 欄位是脫鉤前的主站 id，不能拿來比對。
	err := r.db.Table("storyteller_users").
		Select("id AS user_id, COALESCE(NULLIF(pen_name, ''), display_name, '') AS name").
		Where("id IN ?", userIDs).
		Scan(&rows).Error
	for _, row := range rows {
		names[row.UserID] = row.Name
	}
	return names, err
}

// AuditCredentials 取出本人的 PAT（含已撤銷），讓事件列表能顯示憑證名稱；
// 已撤銷的 PAT 仍要能對回名稱，才看得出「是哪支被撤銷的 token 做的」。
func (r *Repository) AuditCredentials(userID uint64, publicIDs []string) ([]storytellerModel.PersonalAccessToken, error) {
	rows := make([]storytellerModel.PersonalAccessToken, 0)
	query := r.db.Where("user_id = ?", userID)
	if publicIDs != nil {
		if len(publicIDs) == 0 {
			return rows, nil
		}
		query = query.Where("public_id IN ?", publicIDs)
	}
	err := query.Order("created_at DESC, id DESC").Find(&rows).Error
	return rows, err
}

// auditTargetNameQueries 列出各目標類型的名稱來源；全部限定在登入者擁有的專案內，
// 已刪除的目標仍回傳名稱，方便事後追查「被刪掉的是哪一篇」。
var auditTargetNameQueries = map[string]string{
	"project": `SELECT public_id, name FROM storyteller_projects WHERE user_id = ? AND public_id IN ?`,
	"story": `SELECT s.public_id, s.title AS name FROM storyteller_stories s
		JOIN storyteller_projects p ON p.id = s.project_id WHERE p.user_id = ? AND s.public_id IN ?`,
	"lore": `SELECT l.public_id, l.title AS name FROM storyteller_lores l
		JOIN storyteller_projects p ON p.id = l.project_id WHERE p.user_id = ? AND l.public_id IN ?`,
	"lore_collection": `SELECT c.public_id, c.name FROM storyteller_lore_collections c
		JOIN storyteller_projects p ON p.id = c.project_id WHERE p.user_id = ? AND c.public_id IN ?`,
	"asset": `SELECT public_id, COALESCE(NULLIF(title, ''), original_filename) AS name FROM storyteller_assets
		WHERE user_id = ? AND public_id IN ?`,
	"asset_collection": `SELECT c.public_id, c.name FROM storyteller_asset_collections c
		JOIN storyteller_projects p ON p.id = c.project_id WHERE p.user_id = ? AND c.public_id IN ?`,
	"memory": `SELECT public_id, COALESCE(memory_name, '') AS name FROM storyteller_assistant_memories
		WHERE user_id = ? AND public_id IN ?`,
}

// AuditTargetNames 依類型批次查目標名稱，一種類型一個查詢，避免逐筆 N+1。
// volume 在資料表裡也是 story，共用同一個查詢。
func (r *Repository) AuditTargetNames(userID uint64, refs []storytellerModel.AuditTargetRef) (map[storytellerModel.AuditTargetRef]string, error) {
	byType := map[string][]string{}
	for _, ref := range refs {
		table := ref.Type
		if table == "volume" {
			table = "story"
		}
		if _, ok := auditTargetNameQueries[table]; ok && ref.PublicID != "" {
			byType[table] = append(byType[table], ref.PublicID)
		}
	}
	names := make(map[storytellerModel.AuditTargetRef]string, len(refs))
	for table, publicIDs := range byType {
		rows := make([]struct {
			PublicID string
			Name     string
		}, 0, len(publicIDs))
		if err := r.db.Raw(auditTargetNameQueries[table], userID, publicIDs).Scan(&rows).Error; err != nil {
			return nil, err
		}
		for _, row := range rows {
			names[storytellerModel.AuditTargetRef{Type: table, PublicID: row.PublicID}] = row.Name
		}
	}
	return names, nil
}
