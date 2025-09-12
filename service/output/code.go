package output

type CustomCode string

const (
	CustomCodeSuccess    CustomCode = "000000"
	CustomCodeBadRequest            = "400001"
	CustomCodeDBError    CustomCode = "500001" // DB 錯誤
)
