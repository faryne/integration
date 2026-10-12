package api

// Profile 只取 Writer 畫面需要的作者欄位（後端回傳的是完整 UserProfileOutput）。
type Profile struct {
	PenName   string `json:"pen_name"`
	AvatarURL string `json:"avatar_url"`
	// 自動存檔設定跟網站共用（作者在網站設定頁改的開關與間隔）
	AutoSaveEnabled         bool `json:"auto_save_enabled"`
	AutoSaveIntervalMinutes int  `json:"auto_save_interval_minutes"`
}

// Project 是專案卡片需要的摘要；故事數與字數在這裡先算好，前端不用碰故事列表。
type Project struct {
	PublicID    string `json:"public_id"`
	Name        string `json:"name"`
	Description string `json:"description"`
	Visibility  string `json:"visibility"`
	CoverURL    string `json:"cover_url"`
	StoryCount  int    `json:"story_count"`
	WordCount   uint   `json:"word_count"`
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
