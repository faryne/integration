package av

// ActressLink 女優頁「連結」區塊的一筆參考連結；Title 沒填時前端顯示網域
type ActressLink struct {
	Title string `json:"title"`
	URL   string `json:"url"`
}

// ActressFields 女優的資料欄位：dmm_actresses.info、ES 文件、上稿提交內容共用同一份格式。
// 不加 omitempty，讓 diff／覆寫時每個欄位都有明確的值（0、空字串、空陣列）
type ActressFields struct {
	Name       string        `json:"name"`
	Kana       string        `json:"kana"`
	Photo      string        `json:"photo"`
	Height     int           `json:"height"`
	Bust       int           `json:"bust"`
	Waist      int           `json:"waist"`
	Hips       int           `json:"hips"`
	Cup        string        `json:"cup"`
	Horoscope  string        `json:"horoscope"`
	Blood      string        `json:"blood"`
	BornCity   string        `json:"born_city"`
	BirthYear  int           `json:"birth_year"`
	BirthMonth int           `json:"birth_month"`
	BirthDay   int           `json:"birth_day"`
	Interests  []string      `json:"interests"`
	Links      []ActressLink `json:"links"`
	// Aliases 別名（不含本名）：xcity 個人頁、DMM 名字括號裡的別名、手動上稿三者的聯集
	Aliases []string `json:"aliases"`
}

// ActressEditableFields 開放上稿修改的欄位（json key），diff 與覆寫都照這個順序；星座不開放填
var ActressEditableFields = []string{
	"name", "aliases", "kana", "photo", "height", "bust", "waist", "hips", "cup",
	"blood", "born_city", "birth_year", "birth_month", "birth_day", "interests", "links",
}
