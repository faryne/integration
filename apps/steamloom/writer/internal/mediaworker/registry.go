package mediaworker

import (
	"context"
	"errors"
	"sort"
)

type Adapter interface {
	Descriptor() AdapterDescriptor
	Discover(context.Context, map[string]string, map[string]string) (Discovery, error)
}

// Generator 由可真正執行 Media Job 的 adapter 實作；只有 discovery 同時提供 JobFields 才會暴露給 Agent。
type Generator interface {
	Generate(context.Context, map[string]string, map[string]string, map[string]any, string) (GenerateResult, error)
}

// Registry 是 Writer 內唯一的 adapter 清單；UI 與後續 Media Job 都從這裡取得實作。
type Registry struct{ adapters map[string]Adapter }

// NewRegistry 建立 Registry，並拒絕空白或重複的 adapter ID。
func NewRegistry(adapters ...Adapter) (*Registry, error) {
	registry := &Registry{adapters: map[string]Adapter{}}
	for _, adapter := range adapters {
		descriptor := adapter.Descriptor()
		if descriptor.ID == "" {
			return nil, errors.New("Worker adapter ID 不能留白")
		}
		if _, exists := registry.adapters[descriptor.ID]; exists {
			return nil, errors.New("Worker adapter ID 重複：" + descriptor.ID)
		}
		registry.adapters[descriptor.ID] = adapter
	}
	return registry, nil
}

func (r *Registry) List() []AdapterDescriptor {
	result := make([]AdapterDescriptor, 0, len(r.adapters))
	for _, adapter := range r.adapters {
		result = append(result, adapter.Descriptor())
	}
	sort.Slice(result, func(i, j int) bool { return result[i].Name < result[j].Name })
	return result
}

// Get 取得已註冊 adapter，供設定驗證與 capability discovery 共用。
func (r *Registry) Get(id string) (Adapter, bool) {
	adapter, ok := r.adapters[id]
	return adapter, ok
}
