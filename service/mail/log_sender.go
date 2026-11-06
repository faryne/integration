package mail

import (
	"context"

	"faryne.dev/service/log"
	"go.uber.org/zap"
)

// logSender 不真的寄信，只把內容寫進 log：本機與測試環境的預設值，
// 拿真實資料測試時不會誤寄到使用者信箱，信裡的驗證連結也能直接從 log 複製。
// 內容可能含驗證／重設密碼連結，prod 一定要改用真的寄信管道
type logSender struct{}

func (logSender) send(_ context.Context, msg Message) error {
	log.Logger().Info("Mail (log driver, not sent)",
		zap.String("from", msg.From),
		zap.Strings("to", msg.To),
		zap.String("subject", msg.Subject),
		zap.String("text", msg.Text),
		zap.String("html", msg.HTML),
	)
	return nil
}
