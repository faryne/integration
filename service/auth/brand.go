package auth

const (
	// BrandMain 是主站與目前尚未拆分 user table 的既有產品線 session brand。
	BrandMain = "main"
	// BrandStoryteller 是 steamloom.works / storyteller 專用 session brand。
	BrandStoryteller = "storyteller"
	// BrandNekomaid 是 neko.maid.tw 專用 session brand；使用者在 users_v2，id 會跟主站 users 撞號，靠 brand 區分。
	BrandNekomaid = "nekomaid"
	// BrandJoyu 是 joyu.fyi：不用 session、也沒有 users 表，每次請求直接驗證 joyu-firebase 簽發的 ID token（見 middleware/joyuauth）
	BrandJoyu = "joyu"
)
