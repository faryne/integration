package telegram

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"

	"faryne.dev/config"
)

// sendMediaGroup 一次最多 10 張
const maxMediaGroupSize = 10

// SendMessage 用 HTML parse mode 發送到 TG_CHAT_ID；
// 內容中來自外部的文字（標題、人名）呼叫端要先 html.EscapeString，不然 <、& 會讓整則送失敗
func SendMessage(ctx context.Context, text string) error {
	return call(ctx, "sendMessage", map[string]any{
		"text":                     text,
		"parse_mode":               "HTML",
		"disable_web_page_preview": true,
	})
}

// SendPhotos 以相簿（sendMediaGroup）發送圖片網址，超過 10 張只取前 10 張；圖片由 Telegram 端自行下載
func SendPhotos(ctx context.Context, urls []string) error {
	if len(urls) == 0 {
		return nil
	}
	media := make([]map[string]string, 0, min(len(urls), maxMediaGroupSize))
	for _, u := range urls[:min(len(urls), maxMediaGroupSize)] {
		media = append(media, map[string]string{"type": "photo", "media": u})
	}
	return call(ctx, "sendMediaGroup", map[string]any{"media": media})
}

// call 呼叫 Bot API；chat_id 統一由設定帶入
func call(ctx context.Context, method string, payload map[string]any) error {
	cfg := config.EnvConfig()
	if cfg.TelegramBotToken == "" || cfg.TelegramChatID == "" {
		return fmt.Errorf("telegram bot token or chat id is not configured")
	}
	payload["chat_id"] = cfg.TelegramChatID
	body, err := json.Marshal(payload)
	if err != nil {
		return err
	}
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, "https://api.telegram.org/bot"+cfg.TelegramBotToken+"/"+method, bytes.NewReader(body))
	if err != nil {
		return err
	}
	req.Header.Set("Content-Type", "application/json")
	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		b, _ := io.ReadAll(io.LimitReader(resp.Body, 512))
		return fmt.Errorf("telegram %s failed: status=%d body=%s", method, resp.StatusCode, b)
	}
	return nil
}
