package storyteller

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"sort"
	"strings"
	"time"

	storytellerModel "faryne.dev/model/entity/storyteller"
	"faryne.dev/service/log"
)

const openRouterModelsURL = "https://openrouter.ai/api/v1/models"

type openRouterModelsResponse struct {
	Data []openRouterModel `json:"data"`
}

type openRouterModel struct {
	ID           string            `json:"id"`
	Name         string            `json:"name"`
	Description  string            `json:"description"`
	Pricing      map[string]string `json:"pricing"`
	Architecture struct {
		OutputModalities []string `json:"output_modalities"`
	} `json:"architecture"`
}

func RunSyncStorytellerAgentModels() {
	ctx, cancel := context.WithTimeout(context.Background(), 2*time.Minute)
	defer cancel()
	if err := NewService().SyncAgentModelsFromOpenRouter(ctx); err != nil {
		log.Logger().Error("Storyteller agent model sync failed: " + err.Error())
	}
}

func (s *Service) SyncAgentModelsFromOpenRouter(ctx context.Context) error {
	models, err := fetchOpenRouterModels(ctx, openRouterModelsURL, &http.Client{Timeout: 60 * time.Second})
	if err != nil {
		return err
	}
	grouped := groupOpenRouterModels(models)
	for provider, providerModels := range grouped {
		if len(providerModels) == 0 {
			continue
		}
		if err := s.repo.SyncAgentModels(provider, providerModels); err != nil {
			return fmt.Errorf("sync %s models failed: %w", provider, err)
		}
	}
	return nil
}

func fetchOpenRouterModels(ctx context.Context, endpoint string, client *http.Client) ([]openRouterModel, error) {
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, endpoint, nil)
	if err != nil {
		return nil, err
	}
	req.Header.Set("Accept", "application/json")
	resp, err := client.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()
	if resp.StatusCode < http.StatusOK || resp.StatusCode >= http.StatusMultipleChoices {
		return nil, fmt.Errorf("openrouter models api returned status %d", resp.StatusCode)
	}
	var output openRouterModelsResponse
	if err := json.NewDecoder(resp.Body).Decode(&output); err != nil {
		return nil, err
	}
	return output.Data, nil
}

func groupOpenRouterModels(models []openRouterModel) map[storytellerModel.AgentProvider][]storytellerModel.AgentModelSyncInput {
	// OpenRouter 的模型清單同時帶有原始供應商 prefix，可作為直連 provider 的模型來源。
	grouped := map[storytellerModel.AgentProvider]map[string]storytellerModel.AgentModelSyncInput{
		storytellerModel.AgentProviderOpenRouter: {},
		storytellerModel.AgentProviderOpenAI:     {},
		storytellerModel.AgentProviderClaude:     {},
		storytellerModel.AgentProviderGrok:       {},
	}
	for _, model := range models {
		id := strings.TrimSpace(model.ID)
		if id == "" || !openRouterModelSupportsText(model) {
			continue
		}
		label := strings.TrimSpace(model.Name)
		if label == "" {
			label = id
		}
		price := openRouterModelPrice(model.Pricing)
		grouped[storytellerModel.AgentProviderOpenRouter][id] = storytellerModel.AgentModelSyncInput{
			Name:        id,
			Label:       label,
			Description: strings.TrimSpace(model.Description),
			Price:       price,
		}
		// 直連供應商不需要 OpenRouter prefix，避免使用者拿到無法直接呼叫的模型名稱。
		addDirectProviderModel(grouped, storytellerModel.AgentProviderOpenAI, id, "openai/", label, model.Description, price)
		addDirectProviderModel(grouped, storytellerModel.AgentProviderClaude, id, "anthropic/", label, model.Description, price)
		addDirectProviderModel(grouped, storytellerModel.AgentProviderGrok, id, "x-ai/", label, model.Description, price)
	}

	output := make(map[storytellerModel.AgentProvider][]storytellerModel.AgentModelSyncInput, len(grouped))
	for provider, modelMap := range grouped {
		rows := make([]storytellerModel.AgentModelSyncInput, 0, len(modelMap))
		for _, model := range modelMap {
			rows = append(rows, model)
		}
		sort.Slice(rows, func(i, j int) bool {
			return rows[i].Name < rows[j].Name
		})
		for index := range rows {
			rows[index].Sort = (index + 1) * 10
		}
		output[provider] = rows
	}
	return output
}

func addDirectProviderModel(grouped map[storytellerModel.AgentProvider]map[string]storytellerModel.AgentModelSyncInput, provider storytellerModel.AgentProvider, id string, prefix string, label string, description string, price string) {
	if !strings.HasPrefix(id, prefix) {
		return
	}
	name := strings.TrimPrefix(id, prefix)
	if name == "" {
		return
	}
	grouped[provider][name] = storytellerModel.AgentModelSyncInput{
		Name:        name,
		Label:       label,
		Description: strings.TrimSpace(description),
		Price:       price,
	}
}

func openRouterModelPrice(pricing map[string]string) string {
	if len(pricing) == 0 {
		return ""
	}
	value, err := json.Marshal(pricing)
	if err != nil {
		return ""
	}
	return string(value)
}

func openRouterModelSupportsText(model openRouterModel) bool {
	if len(model.Architecture.OutputModalities) == 0 {
		// 舊資料或部分供應商可能沒標 modalities；保守保留，避免可用模型被誤刪。
		return true
	}
	for _, modality := range model.Architecture.OutputModalities {
		if strings.EqualFold(modality, "text") {
			return true
		}
	}
	return false
}
