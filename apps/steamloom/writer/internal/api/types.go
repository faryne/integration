package api

// Profile 只取 Writer 畫面需要的作者欄位（後端回傳的是完整 UserProfileOutput）。
type Profile struct {
	PenName   string `json:"pen_name"`
	AvatarURL string `json:"avatar_url"`
	// 自動存檔設定跟網站共用（作者在網站設定頁改的開關與間隔）
	AutoSaveEnabled         bool `json:"auto_save_enabled"`
	AutoSaveIntervalMinutes int  `json:"auto_save_interval_minutes"`
	// Profiles 是本人以外的筆名，故事署名的選項（本人固定是 id 0）
	Profiles []PenNameProfile `json:"profiles"`
}

type PenNameProfile struct {
	ID      uint64 `json:"id"`
	PenName string `json:"pen_name"`
}

// Project 是專案卡片需要的摘要；故事數與字數在這裡先算好，前端不用碰故事列表。
type Project struct {
	PublicID    string `json:"public_id"`
	Name        string `json:"name"`
	Description string `json:"description"`
	Visibility  string `json:"visibility"`
	// Slug／Rating／Tags：專案選單切換公開狀態是整包 PUT，沒帶回這些欄位會被清空
	Slug       string   `json:"slug"`
	Rating     string   `json:"rating"`
	Tags       []string `json:"tags"`
	CoverURL   string   `json:"cover_url"`
	StoryCount int      `json:"story_count"`
	WordCount  uint     `json:"word_count"`
	// UpdatedAt 維持後端給的 RFC 3339 字串，前端自己格式化
	UpdatedAt string `json:"updated_at"`
}

// projectRow 對應後端 ProjectOutput 中用得到的欄位。
type projectRow struct {
	Project
	Stories []struct {
		WordCount uint `json:"word_count"`
	} `json:"stories"`
}

func (row projectRow) toProject() Project {
	project := row.Project
	project.StoryCount = len(row.Stories)
	for _, story := range row.Stories {
		project.WordCount += story.WordCount
	}
	return project
}
