package discord

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strings"

	"faryne.dev/config"
)

type WebhookRequest struct {
	Content string `json:"content"`
}

type ServiceDiscord struct {
	webhookURL string
}

func NewServiceDiscord() *ServiceDiscord {
	return &ServiceDiscord{
		webhookURL: config.EnvConfig().DiscordWebhook,
	}
}

func (s *ServiceDiscord) SendMessage(ctx context.Context, message string) error {
	if s.webhookURL == "" {
		return fmt.Errorf("discord webhook URL is not configured")
	}

	// Discord has a 2000 character limit for messages.
	// We'll split the message into chunks if it exceeds the limit.
	const maxLimit = 1900 // Use a slightly smaller limit to be safe
	if len(message) <= maxLimit {
		return s.sendRawMessage(ctx, message)
	}

	chunks := s.splitMessage(message, maxLimit)
	for _, chunk := range chunks {
		if err := s.sendRawMessage(ctx, chunk); err != nil {
			return err
		}
	}

	return nil
}

func (s *ServiceDiscord) splitMessage(message string, limit int) []string {
	var chunks []string
	for len(message) > limit {
		// Try to split at a newline if possible
		splitIdx := strings.LastIndex(message[:limit], "\n")
		if splitIdx == -1 {
			splitIdx = limit
		}
		chunks = append(chunks, message[:splitIdx])
		message = strings.TrimSpace(message[splitIdx:])
	}
	if len(message) > 0 {
		chunks = append(chunks, message)
	}
	return chunks
}

func (s *ServiceDiscord) sendRawMessage(ctx context.Context, message string) error {
	payload := WebhookRequest{
		Content: message,
	}

	body, err := json.Marshal(payload)
	if err != nil {
		return fmt.Errorf("failed to marshal discord payload: %w", err)
	}

	req, err := http.NewRequestWithContext(ctx, http.MethodPost, s.webhookURL, bytes.NewBuffer(body))
	if err != nil {
		return fmt.Errorf("failed to create discord request: %w", err)
	}
	req.Header.Set("Content-Type", "application/json")

	client := &http.Client{}
	resp, err := client.Do(req)
	if err != nil {
		return fmt.Errorf("failed to send discord request: %w", err)
	}
	defer resp.Body.Close()

	content, err := io.ReadAll(resp.Body)
	if err != nil {
		return fmt.Errorf("failed to read discord response body: %w", err)
	}

	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return fmt.Errorf("discord responded with status: %d with raw: %s", resp.StatusCode, string(content))
	}

	return nil
}
