package output

type CustomCode string

const (
	CustomCodeSuccess              CustomCode = "000000"
	CustomCodeUnauthorized                    = "401001"
	CustomCodeBadRequest                      = "400001"
	CustomCodeNotFound                        = "404001"
	CustomCodeConflict             CustomCode = "409000" // 通用衝突（重複鍵、外鍵限制）；409001 之後是各功能自訂
	CustomCodeInternalServiceError            = "500000"
	CustomCodeDBError              CustomCode = "500001" // DB 錯誤
	CustomCodeESError              CustomCode = "500002" // SearchError
	CustomCodeExternalServiceError CustomCode = "500003" // External Service Error
	CustomCodeMaintenance          CustomCode = "503001" // 網站維護中
)
