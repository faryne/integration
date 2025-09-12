package output

import (
	"github.com/gofiber/utils/v2"
)

type CommonOutput struct {
	Code       int        `json:"code"`           // HTTP Code，例如 `200` / `400` 等
	CostTime   float64    `json:"cost_time" `     // API 執行花費時間，單位為秒。e.g. `1.234`
	Data       any        `json:"data,omitempty"` // 回傳內容，可為空
	CustomCode CustomCode `json:"custom_code"`    // 自訂代碼，通常為六位數字。e.g. `400400`
	Uri        string     `json:"uri"`            // 呼叫 api 路徑，e.g. `/v1/api-token`
	Method     string     `json:"method"`         // HTTP 方法
	Message    string     `json:"message"`        // 執行完成訊息
}

type CommonOutputInterface interface {
	error // 需實作 error.Error() 方法
	HttpCode() int
	Output(costTime float64, uri string) CommonOutput
}

func New(httpCode int, customCode CustomCode, output any, message ...string) CommonOutputInterface {
	var o = CommonOutput{
		Code:       httpCode,
		CustomCode: customCode,
	}
	if output != nil {
		o.Data = output
	}
	o.Message = utils.StatusMessage(httpCode)
	if len(message) > 0 {
		o.Message = message[0]
	}
	return &o
}

// Error 輸出文字訊息。在 message 為空時，使用傳入的 code 取出 message
func (o *CommonOutput) Error() string {
	if o.Message == "" && o.Code >= 100 && o.Code <= 599 {
		return utils.StatusMessage(o.Code)
	}
	return o.Message
}

// Output 最終需要輸出的東西
func (o *CommonOutput) Output(costTime float64, uri string) CommonOutput {
	o.CostTime = costTime
	o.Uri = uri
	return *o
}

// HttpCode 輸出 http code
func (o *CommonOutput) HttpCode() int {
	if o.Code >= 100 && o.Code <= 599 {
		return o.Code
	}
	return 500
}
