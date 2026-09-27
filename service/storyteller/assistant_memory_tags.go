package storyteller

import (
	"encoding/json"
	"errors"
	"strings"
)

const (
	assistantMemoryTagLimit    = 8
	assistantMemoryTagMaxRunes = 24
)

var ErrAssistantMemoryTagsInvalid = errors.New("memory tags must contain at most 8 non-empty items of 24 characters or less")

// normalizeAssistantMemoryTags 保留使用者輸入的顯示文字，但以不分大小寫方式去重；
// kind 是固定系統分類，tags 則只承擔自由整理與提供 AI 判讀方向的用途。
func normalizeAssistantMemoryTags(tags []string) ([]string, error) {
	seen := make(map[string]struct{}, len(tags))
	output := make([]string, 0, len(tags))
	for _, tag := range tags {
		value := strings.TrimSpace(tag)
		if value == "" {
			continue
		}
		if len([]rune(value)) > assistantMemoryTagMaxRunes {
			return nil, ErrAssistantMemoryTagsInvalid
		}
		key := strings.ToLower(value)
		if _, exists := seen[key]; exists {
			continue
		}
		seen[key] = struct{}{}
		output = append(output, value)
		if len(output) > assistantMemoryTagLimit {
			return nil, ErrAssistantMemoryTagsInvalid
		}
	}
	return output, nil
}

func encodeAssistantMemoryTags(tags []string) string {
	normalized, err := normalizeAssistantMemoryTags(tags)
	if err != nil || len(normalized) == 0 {
		return "[]"
	}
	raw, err := json.Marshal(normalized)
	if err != nil {
		return "[]"
	}
	return string(raw)
}

func decodeAssistantMemoryTags(raw string) []string {
	tags := make([]string, 0)
	if strings.TrimSpace(raw) == "" || json.Unmarshal([]byte(raw), &tags) != nil {
		return tags
	}
	normalized, err := normalizeAssistantMemoryTags(tags)
	if err != nil {
		return make([]string, 0)
	}
	return normalized
}
