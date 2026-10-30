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
	// DMMID DMM 女優 ID：用來把同名不同人的新影片分開；空字串代表未對應。
	// 只給內部爬蟲寫入，不開放上稿（不在 ActressEditableFields 裡，提交內容一律清空）
	DMMID string `json:"dmm_id"`
}

// ActressEditableFields 開放上稿修改的欄位（json key），diff 與覆寫都照這個順序；星座不開放填
var ActressEditableFields = []string{
	"name", "kana", "photo", "height", "bust", "waist", "hips", "cup",
	"blood", "born_city", "birth_year", "birth_month", "birth_day", "interests", "links",
}
