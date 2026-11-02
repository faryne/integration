package output

import (
	"time"

	"github.com/gofiber/fiber/v3"
)

// FromContext 依 request context 補上耗時、完整 URI 與 HTTP method，組出最終回應內容。
// 全域 ErrorHandler 與 encrypted middleware 共用這份組裝邏輯，避免兩邊各寫一套而產生分歧。
// start_time 由 main.go 最前面的 middleware 以 UnixMilli（int64）寫入；拿不到或型別不符時耗時記為 -1。
func FromContext(ctx fiber.Ctx, out CommonOutputInterface) CommonOutput {
	costTime := float64(-1)
	if startedAt, ok := ctx.Locals("start_time").(int64); ok {
		costTime = float64(time.Now().UnixMilli()-startedAt) / float64(time.Microsecond)
	}
	uri := ctx.Scheme() + "://" + ctx.Hostname() + ctx.Path()
	if args := ctx.Request().URI().QueryArgs(); args.Len() > 0 {
		uri += "?" + args.String()
	}
	finalOutput := out.Output(costTime, uri)
	finalOutput.Method = ctx.Method()
	return finalOutput
}
