package telegram

import (
	"context"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"strings"

	"faryne.dev/config"
)

// SendMessage 用 HTML parse mode 發送到 TG_CHAT_ID；
// 內容中來自外部的文字（標題、人名）呼叫端要先 html.EscapeString，不然 <、& 會讓整則送失敗
func SendMessage(ctx context.Context, text string) error {
	cfg := config.EnvConfig()
	if cfg.TelegramBotToken == "" || cfg.TelegramChatID == "" {
		return fmt.Errorf("telegram bot token or chat id is not configured")
	}
	form := url.Values{
		"chat_id":                  {cfg.TelegramChatID},
		"text":                     {text},
		"parse_mode":               {"HTML"},
		"disable_web_page_preview": {"true"},
	}
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, "https://api.telegram.org/bot"+cfg.TelegramBotToken+"/sendMessage", strings.NewReader(form.Encode()))
	if err != nil {
		return err
	}
	req.Header.Set("Content-Type", "application/x-www-form-urlencoded")
	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(io.LimitReader(resp.Body, 512))
		return fmt.Errorf("telegram send failed: status=%d body=%s", resp.StatusCode, body)
	}
	return nil
}
