package mediaworker

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"strings"
)

// CatalogItem 是「常用清單」設定欄位（SettingField.Kind == "catalog"）的一項；
// 整份清單以 JSON 字串存在 Worker settings，不是密鑰。Weight 只在欄位宣告 ItemWeight 時有意義。
type CatalogItem struct {
	ID     string  `json:"id"`
	Name   string  `json:"name"`
	Weight float64 `json:"weight"`
}

// CatalogResolver 由支援「貼網址加入常用清單」的 adapter 實作：把作者貼的網址解析成一項（ID＋預設名稱）。
// 只做唯讀查詢，不得送出生成工作或扣額度。
type CatalogResolver interface {
	ResolveCatalogItem(ctx context.Context, fieldKey, rawURL string) (CatalogItem, error)
}

// parseCatalog 解析 settings 裡的清單；空字串視為空清單。
func parseCatalog(raw string) ([]CatalogItem, error) {
	if strings.TrimSpace(raw) == "" {
		return []CatalogItem{}, nil
	}
	var items []CatalogItem
	if err := json.Unmarshal([]byte(raw), &items); err != nil {
		return nil, errors.New("清單格式不正確")
	}
	return items, nil
}

// validateCatalog 在 Save 時檢查清單：ID 不可空白或重複、名稱必填、權重 0～1。
func validateCatalog(field SettingField, raw string) error {
	items, err := parseCatalog(raw)
	if err != nil {
		return fmt.Errorf("%s：%w", field.Label, err)
	}
	seen := make(map[string]bool, len(items))
	for _, item := range items {
		switch {
		case strings.TrimSpace(item.ID) == "" || seen[item.ID]:
			return fmt.Errorf("%s：項目 ID 空白或重複", field.Label)
		case strings.TrimSpace(item.Name) == "":
			return fmt.Errorf("%s：名稱不能留白", field.Label)
		case field.ItemWeight && (item.Weight < 0 || item.Weight > 1):
			return fmt.Errorf("%s：%s 的權重必須介於 0～1", field.Label, item.Name)
		}
		seen[item.ID] = true
	}
	return nil
}

// ResolveCatalogItem 讓設定頁把網址交給 adapter 解析；只接受該 adapter 宣告為 catalog 的欄位。
func (s *Service) ResolveCatalogItem(ctx context.Context, adapterID, fieldKey, rawURL string) (*CatalogItem, error) {
	adapter, ok := s.registry.Get(adapterID)
	if !ok {
		return nil, errors.New("找不到指定的 Worker adapter")
	}
	resolver, ok := adapter.(CatalogResolver)
	if !ok || !hasCatalogField(adapter.Descriptor(), fieldKey) {
		return nil, errors.New("這個 Worker 不支援常用清單")
	}
	item, err := resolver.ResolveCatalogItem(ctx, fieldKey, strings.TrimSpace(rawURL))
	if err != nil {
		return nil, err
	}
	return &item, nil
}

func hasCatalogField(descriptor AdapterDescriptor, key string) bool {
	for _, field := range descriptor.Fields {
		if field.Key == key && field.Kind == "catalog" {
			return true
		}
	}
	return false
}
