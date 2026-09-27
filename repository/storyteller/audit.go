package storyteller

import (
	storytellerModel "faryne.dev/model/entity/storyteller"
	"gorm.io/gorm/clause"
	"gorm.io/plugin/dbresolver"
)

// AuditProjectByPublicID 強制走 primary，避免業務剛 commit、replica 尚未追上時漏掉 project_id。
func (r *Repository) AuditProjectByPublicID(userID uint64, publicID string) (*storytellerModel.Project, error) {
	var project storytellerModel.Project
	err := r.db.Clauses(dbresolver.Write).
		Where("user_id = ? AND public_id = ?", userID, publicID).
		First(&project).Error
	return &project, err
}

// InsertAuditEvents 使用 event_id UNIQUE 配合 INSERT IGNORE，讓 Stream at-least-once
// delivery 可以安全重送，不會產生重複稽核事件。
func (r *Repository) InsertAuditEvents(events []*storytellerModel.AuditEvent) error {
	if len(events) == 0 {
		return nil
	}
	return r.db.Clauses(clause.Insert{Modifier: "IGNORE"}).CreateInBatches(events, 100).Error
}
