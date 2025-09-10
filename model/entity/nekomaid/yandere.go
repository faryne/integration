package nekomaid

type YandereTagOutput struct {
	Id        int64  `json:"id"`
	Name      string `json:"name"`
	AliasName string `json:"alias_name"`
	Counts    int64  `json:"counts"`
	TypeId    int64  `json:"type_id"`
}

type YandereTag struct {
	Id   int64  `json:"id"`
	Name string `json:"name"`
}
