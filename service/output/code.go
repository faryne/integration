package output

type CustomCode string

const (
	CustomCodeSuccess              CustomCode = "000000"
	CustomCodeUnauthorized                    = "401001"
	CustomCodeBadRequest                      = "400001"
	CustomCodeNotFound                        = "404001"
	CustomCodeInternalServiceError            = "500000"
	CustomCodeDBError              CustomCode = "500001" // DB 錯誤
	CustomCodeESError              CustomCode = "500002" // SearchError
	CustomCodeExternalServiceError CustomCode = "500003" // External Service Error
)
