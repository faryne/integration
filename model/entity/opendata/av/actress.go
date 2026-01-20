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

type VideoQueryRequest struct {
	Year    int    `query:"year"`
	Month   int    `query:"month"`
	Day     int    `query:"day"`
	Keyword string `query:"keyword"`
	Tag     string `query:"tag"`
	Actress string `query:"actress"`
	Page    int    `query:"page"`
}
