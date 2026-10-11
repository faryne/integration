package storyteller

// NotificationInput 是一則要送出的站內通知；GroupKey 是冪等鍵，同一收件人同一 key 只會有一筆。
// 會序列化成 steamloom.notification 訊息的 Payload，所以欄位要向後相容（新增 OK，改名／刪欄位要小心）。
type NotificationInput struct {
	UserID    uint64              `json:"user_id"`
	Kind      NotificationKind    `json:"kind"`
	GroupKey  string              `json:"group_key"`
	ProjectID *uint64             `json:"project_id,omitempty"`
	Payload   NotificationPayload `json:"payload"`
}
