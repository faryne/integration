package storyteller

// NotificationKind 是通知類型；DB 只存快照 payload，不存整句文字。
type NotificationKind string

const (
	NotificationKindStoryPublished   NotificationKind = "story.published"
	NotificationKindProjectPublished NotificationKind = "project.published"
	NotificationKindOAuthAuthorized  NotificationKind = "security.oauth.authorized"
	NotificationKindPATCreated       NotificationKind = "security.pat.created"
	NotificationKindAuthorFollowed   NotificationKind = "author.followed"
	NotificationKindProjectFavorited NotificationKind = "project.favorited"
)

// NotificationCategory 是通知的大類，前端拿來決定圖示顏色與「帳號安全」之類的標記。
type NotificationCategory string

const (
	NotificationCategoryContent  NotificationCategory = "content"
	NotificationCategorySecurity NotificationCategory = "security"
	NotificationCategoryGeneral  NotificationCategory = "general"
	NotificationCategorySocial   NotificationCategory = "social"
)

// NotificationView 是前端用哪一種內容頁呈現。前端只認識這幾種畫面、不寫死 kind：
// 新類型沿用既有 view 就不用改前端；前端不認識的 view 一律退回 generic（顯示 title／body／link）。
type NotificationView string

const (
	NotificationViewStories  NotificationView = "stories"  // 列出這次更新的每一話
	NotificationViewProject  NotificationView = "project"  // 新作品：簡介、tags、話數
	NotificationViewSecurity NotificationView = "security" // 憑證資訊＋「不是你本人操作？」
	NotificationViewGeneric  NotificationView = "generic"  // 只用通用欄位 title／body／link
	NotificationViewFollower NotificationView = "follower" // 追蹤者頭像＋回追
	NotificationViewFavorite NotificationView = "favorite" // 被收藏的作品＋收藏者＋回追
)

type NotificationKindDefinition struct {
	Kind     NotificationKind     `json:"kind"`
	Label    string               `json:"label"`
	Category NotificationCategory `json:"category"`
	View     NotificationView     `json:"view"`
}

// NotificationKinds 是唯一的通知類型註冊表：GET /storyteller/notification-kinds 直接輸出給前端，
// storytellernotify.Notify 也會拒絕這裡沒有的 kind。新增類型只要在這裡加一筆。
var NotificationKinds = []NotificationKindDefinition{
	{Kind: NotificationKindStoryPublished, Label: "新話公開", Category: NotificationCategoryContent, View: NotificationViewStories},
	{Kind: NotificationKindProjectPublished, Label: "新作品公開", Category: NotificationCategoryContent, View: NotificationViewProject},
	{Kind: NotificationKindOAuthAuthorized, Label: "OAuth 授權", Category: NotificationCategorySecurity, View: NotificationViewSecurity},
	{Kind: NotificationKindPATCreated, Label: "建立 Personal Access Token", Category: NotificationCategorySecurity, View: NotificationViewSecurity},
	{Kind: NotificationKindAuthorFollowed, Label: "追蹤", Category: NotificationCategorySocial, View: NotificationViewFollower},
	{Kind: NotificationKindProjectFavorited, Label: "收藏作品", Category: NotificationCategorySocial, View: NotificationViewFavorite},
}

func IsNotificationKindRegistered(kind NotificationKind) bool {
	for _, definition := range NotificationKinds {
		if definition.Kind == kind {
			return true
		}
	}
	return false
}
