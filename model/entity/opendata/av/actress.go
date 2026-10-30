package av

type ActressQuery struct {
	Syllabus string `query:"syllabus" validate:"required"`
	Page     int    `query:"page" validate:"required"`
}

type ActressQueryRequest struct {
	Cup string `query:"cup"`
	// Cups 複選罩杯，逗號分隔（cups=A,B,D），符合任一個即可；可與 Cup 並用
	Cups       string `query:"cups"`
	B          []int  `query:"b"`
	W          []int  `query:"w"`
	H          []int  `query:"h"`
	Height     []int  `query:"height"`
	Name       string `query:"name"`
	BirthYear  int    `query:"birth_year"`
	BirthMonth int    `query:"birth_month"`
	BirthDay   int    `query:"birth_day"`
	BloodType  string `query:"blood_type"`
	// 女優頁網址的參數，精確指定一位：xcity_id／manual_id 直接查，dmm_id 先查對照表 dmm_actress_maps；
	// 同時帶多個時依 xcity_id → manual_id → dmm_id 的順序，都對不到就當成沒帶
	XCityID  int    `query:"xcity_id"`
	ManualID int    `query:"manual_id"`
	DMMID    string `query:"dmm_id"`
	Page     int    `query:"page"`
}

type Actress struct {
	// Domain＋AID 指向 dmm_actresses 的那一筆，修改資料時用來指定要改哪位
	Domain     string        `json:"domain"`
	AID        int           `json:"aid"`
	Links      []ActressLink `json:"links"`
	Blood      string        `json:"blood"`
	Height     any           `json:"height"`
	Kana       string        `json:"kana"`
	Bust       any           `json:"bust"`
	Cup        string        `json:"cup"`
	BirthMonth int           `json:"birth_month"`
	Horoscope  string        `json:"horoscope"`
	Name       string        `json:"name"`
	Photo      string        `json:"photo"`
	Waist      any           `json:"waist"`
	BornCity   string        `json:"born_city"`
	BirthYear  int           `json:"birth_year"`
	BirthDay   int           `json:"birth_day"`
	Hips       any           `json:"hips"`
	Interests  []any         `json:"interests"`
}
