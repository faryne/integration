package av

type ActressQuery struct {
	Syllabus string `query:"syllabus" validate:"required"`
	Page     int    `query:"page" validate:"required"`
}
