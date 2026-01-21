package av

type ActressQuery struct {
	Syllabus string `query:"syllabus" validate:"required"`
	Page     int    `query:"page" validate:"required"`
}

type ActressQueryRequest struct {
	Cup        string `query:"cup"`
	B          []int  `query:"b"`
	W          []int  `query:"w"`
	H          []int  `query:"h"`
	Height     []int  `query:"height"`
	Name       string `query:"name"`
	BirthYear  int    `query:"birth_year"`
	BirthMonth int    `query:"birth_month"`
	BirthDay   int    `query:"birth_day"`
	BloodType  string `query:"blood_type"`
	Page       int    `query:"page"`
}

type Actress struct {
	Blood      string        `json:"blood"`
	Height     int           `json:"height"`
	Kana       string        `json:"kana"`
	Bust       int           `json:"bust"`
	Cup        string        `json:"cup"`
	BirthMonth int           `json:"birth_month"`
	Horoscope  string        `json:"horoscope"`
	Name       string        `json:"name"`
	Photo      string        `json:"photo"`
	Waist      int           `json:"waist"`
	BornCity   string        `json:"born_city"`
	BirthYear  int           `json:"birth_year"`
	BirthDay   int           `json:"birth_day"`
	Hips       int           `json:"hips"`
	Interests  []interface{} `json:"interests"`
}
