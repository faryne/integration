package mediaworker

import (
	"encoding/json"
	"errors"
	"fmt"
	"strconv"
	"strings"
)

// multiselect 的值是 []string；weighted_select 是可增減的「選項＋數值」列，Max 皆代表最多可選幾項。
var supportedJobFieldKinds = map[string]bool{"text": true, "textarea": true, "select": true, "multiselect": true, "weighted_select": true, "number": true, "boolean": true}

func number(value float64) *float64 { return &value }

func validateJobSchema(fields []JobField) error {
	seen := make(map[string]bool, len(fields))
	for _, field := range fields {
		if field.Key == "" || field.Label == "" || !supportedJobFieldKinds[field.Kind] || seen[field.Key] {
			return errors.New("Worker 提供的 Job schema 不正確")
		}
		seen[field.Key] = true
		if (field.Kind == "select" || field.Kind == "multiselect" || field.Kind == "weighted_select") && len(field.Options) == 0 {
			return fmt.Errorf("%s 沒有可用選項", field.Label)
		}
		if field.Kind == "weighted_select" && (field.ItemNumber == nil || field.ItemNumber.Label == "" || field.ItemNumber.Min > field.ItemNumber.Default || field.ItemNumber.Default > field.ItemNumber.Max || field.ItemNumber.Step <= 0) {
			return fmt.Errorf("%s 的列數值設定不正確", field.Label)
		}
		if field.Default != nil {
			if _, err := normalizeJobValue(field, field.Default); err != nil {
				return fmt.Errorf("%s 的預設值不正確：%w", field.Label, err)
			}
		}
	}
	for _, field := range fields {
		if field.VisibleWhen == nil {
			continue
		}
		if !seen[field.VisibleWhen.Key] || len(field.VisibleWhen.Values) == 0 {
			return fmt.Errorf("%s 的顯示條件不正確", field.Label)
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
		if !jobFieldVisible(field, fields, input) {
			continue
		}
		value, exists := input[field.Key]
		if !exists || value == nil || emptyJobValue(field, value) {
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

func jobFieldVisible(field JobField, fields []JobField, input map[string]any) bool {
	if field.VisibleWhen == nil {
		return true
	}
	value, exists := input[field.VisibleWhen.Key]
	if !exists || value == nil || strings.TrimSpace(fmt.Sprint(value)) == "" {
		for _, source := range fields {
			if source.Key == field.VisibleWhen.Key {
				value = source.Default
				break
			}
		}
	}
	for _, expected := range field.VisibleWhen.Values {
		if fmt.Sprint(value) == expected {
			return true
		}
	}
	return false
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
	case "multiselect":
		return multiselectValue(field, value)
	case "weighted_select":
		return weightedSelectValue(field, value)
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

// emptyJobValue 判斷作者沒填：布林永遠算有填；多選是空陣列；其他是空字串。
func emptyJobValue(field JobField, value any) bool {
	switch field.Kind {
	case "boolean":
		return false
	case "multiselect", "weighted_select":
		// []any{} 與 []string{} 印出來都是 "[]"
		return fmt.Sprint(value) == "[]"
	default:
		return strings.TrimSpace(fmt.Sprint(value)) == ""
	}
}

// weightedSelectValue 接受前端的 [{value, weight}]，驗證選項、重複值、權重與列數上限。
func weightedSelectValue(field JobField, value any) ([]JobWeightedSelection, error) {
	raw, ok := value.([]any)
	if !ok {
		if selections, typed := value.([]JobWeightedSelection); typed {
			raw = make([]any, 0, len(selections))
			for _, selection := range selections {
				raw = append(raw, map[string]any{"value": selection.Value, "weight": selection.Weight})
			}
		} else {
			return nil, errors.New("必須是可加權的選項清單")
		}
	}
	if field.Max != nil && float64(len(raw)) > *field.Max {
		return nil, fmt.Errorf("最多只能選 %d 項", int(*field.Max))
	}
	result := make([]JobWeightedSelection, 0, len(raw))
	seen := make(map[string]bool, len(raw))
	for _, item := range raw {
		row, ok := item.(map[string]any)
		if !ok {
			return nil, errors.New("選項資料格式不正確")
		}
		selected, ok := row["value"].(string)
		weight, err := numberValue(row["weight"])
		if !ok || !optionExists(field.Options, selected) || seen[selected] {
			return nil, errors.New("包含不可用或重複的選項")
		}
		if err != nil || weight < field.ItemNumber.Min || weight > field.ItemNumber.Max {
			return nil, errors.New("權重超出允許範圍")
		}
		seen[selected] = true
		result = append(result, JobWeightedSelection{Value: selected, Weight: weight})
	}
	if field.Required && len(result) == 0 {
		return nil, errors.New("至少要選一項")
	}
	return result, nil
}

// multiselectValue 接受前端傳來的 []any 或 Go 端的 []string，逐項檢查是否為可用選項、不重複、不超過 Max。
func multiselectValue(field JobField, value any) ([]string, error) {
	var raw []any
	switch value := value.(type) {
	case []any:
		raw = value
	case []string:
		for _, item := range value {
			raw = append(raw, item)
		}
	default:
		return nil, errors.New("必須是選項清單")
	}
	result := make([]string, 0, len(raw))
	seen := make(map[string]bool, len(raw))
	for _, item := range raw {
		text, ok := item.(string)
		if !ok || !optionExists(field.Options, text) || seen[text] {
			return nil, errors.New("包含不可用或重複的選項")
		}
		seen[text] = true
		result = append(result, text)
	}
	if field.Max != nil && float64(len(result)) > *field.Max {
		return nil, fmt.Errorf("最多只能選 %d 項", int(*field.Max))
	}
	if field.Required && len(result) == 0 {
		return nil, errors.New("至少要選一項")
	}
	return result, nil
}
