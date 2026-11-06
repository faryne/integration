// Package mail 共用寄信服務：呼叫端只組 Message，實際由哪個管道寄出看 MAIL_DRIVER 決定，
// 之後要換 Mailgun 等服務只要多實作一個 sender，呼叫端不用改。
package mail

import (
	"context"
	"errors"
	"strings"
	"sync"

	"faryne.dev/config"
)

// Message 一封信；HTML、Text 至少要有一個（兩個都給時收信端自己挑，純文字是 HTML 被擋時的備案）
type Message struct {
	// From 寄件者，例如 `難以名狀的抓圖器 <noreply@neko.maid.tw>`；留空用 MAIL_DEFAULT_FROM
	From    string
	To      []string
	ReplyTo []string
	Subject string
	HTML    string
	Text    string
}

// sender 寄信管道；新增服務時實作這個介面並在 newSender 註冊
type sender interface {
	send(ctx context.Context, msg Message) error
}

var (
	ErrInvalidMessage = errors.New("mail: 缺少收件者、主旨、寄件者或內容")
	ErrUnknownDriver  = errors.New("mail: 不支援的 MAIL_DRIVER")
)

// current 依設定建立一次寄信管道後重複使用（SES client 本身可共用）
var current = sync.OnceValues(newSender)

func newSender() (sender, error) {
	switch driver := config.EnvConfig().MailDriver; driver {
	case "ses":
		return newSESSender(context.Background())
	case "log", "":
		return logSender{}, nil
	default:
		return nil, errors.Join(ErrUnknownDriver, errors.New(driver))
	}
}

// Send 寄出一封信；From 留空時補上預設寄件者，基本欄位不齊直接回 ErrInvalidMessage
func Send(ctx context.Context, msg Message) error {
	if msg.From == "" {
		msg.From = config.EnvConfig().MailDefaultFrom
	}
	if err := msg.validate(); err != nil {
		return err
	}
	s, err := current()
	if err != nil {
		return err
	}
	return s.send(ctx, msg)
}

func (m Message) validate() error {
	if strings.TrimSpace(m.From) == "" || len(m.To) == 0 || strings.TrimSpace(m.Subject) == "" ||
		(m.HTML == "" && m.Text == "") {
		return ErrInvalidMessage
	}
	return nil
}
