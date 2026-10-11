package storyteller

// ProjectCreatedMessage 是 steamloom.project_created 訊息的 Payload。
// 只帶識別與摘要資訊；consumer 需要完整或最新狀態時應以 ProjectPublicID 回查 DB。
type ProjectCreatedMessage struct {
	ProjectPublicID string            `json:"project_public_id"`
	UserID          uint64            `json:"user_id"`
	Name            string            `json:"name"`
	Visibility      ProjectVisibility `json:"visibility"`
}
