package mediaworker

import (
	"encoding/json"
	"errors"
	"fmt"
	"strconv"
	"strings"
)

var supportedJobFieldKinds = map[string]bool{"text": true, "textarea": true, "select": true, "number": true, "boolean": true}

func validateJobSchema(fields []JobField) error {
	seen := make(map[string]bool, len(fields))
	for _, field := range fields {
		if field.Key == "" || field.Label == "" || !supportedJobFieldKinds[field.Kind] || seen[field.Key] {
			return errors.New("Worker 提供的 Job schema 不正確")
		}
		seen[field.Key] = true
		if field.Kind == "select" && len(field.Options) == 0 {
			return fmt.Errorf("%s 沒有可用選項", field.Label)
		}
		if field.Default != nil {
			if _, err := normalizeJobValue(field, field.Default); err != nil {
				return fmt.Errorf("%s 的預設值不正確：%w", field.Label, err)
			}
		}
	}
	return nil
}

func validateJobInput(fields []JobField, input map[string]any) (map[string]any, error) {
	if err := validateJobSchema(fields); err != nil {
		return nil, err
	}
	known := make(map[string]bool, len(fields))
	result := make(map[string]any, len(fields))
	for _, field := range fields {
		known[field.Key] = true
		value, exists := input[field.Key]
		if !exists || value == nil || (field.Kind != "boolean" && strings.TrimSpace(fmt.Sprint(value)) == "") {
			value, exists = field.Default, field.Default != nil
		}
		if !exists {
			if field.Required {
				return nil, fmt.Errorf("%s不能留白", field.Label)
			}
			continue
		}
		normalized, err := normalizeJobValue(field, value)
		if err != nil {
			return nil, fmt.Errorf("%s：%w", field.Label, err)
		}
		result[field.Key] = normalized
	}
	for key := range input {
		if !known[key] {
			return nil, fmt.Errorf("Worker 不接受欄位 %q", key)
		}
	}
	return result, nil
}

func normalizeJobValue(field JobField, value any) (any, error) {
	switch field.Kind {
	case "text", "textarea", "select":
		text, ok := value.(string)
		if !ok {
			return nil, errors.New("必須是文字")
		}
		text = strings.TrimSpace(text)
		if field.Required && text == "" {
			return nil, errors.New("不能留白")
		}
		if field.Kind == "select" && !optionExists(field.Options, text) {
			return nil, errors.New("不是可用選項")
		}
		return text, nil
	case "number":
		number, err := numberValue(value)
		if err != nil {
			return nil, err
		}
		if field.Min != nil && number < *field.Min || field.Max != nil && number > *field.Max {
			return nil, errors.New("超出允許範圍")
		}
		return number, nil
	case "boolean":
		boolean, ok := value.(bool)
		if !ok {
			return nil, errors.New("必須是布林值")
		}
		return boolean, nil
	default:
		return nil, errors.New("欄位類型不受支援")
	}
}

func optionExists(options []JobOption, value string) bool {
	for _, option := range options {
		if option.Value == value {
			return true
		}
	}
	return false
}

func numberValue(value any) (float64, error) {
	switch value := value.(type) {
	case float64:
		return value, nil
	case float32:
		return float64(value), nil
	case int:
		return float64(value), nil
	case int64:
		return float64(value), nil
	case json.Number:
		return value.Float64()
	case string:
		return strconv.ParseFloat(strings.TrimSpace(value), 64)
	default:
		return 0, errors.New("必須是數字")
	}
}
