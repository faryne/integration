package taipower

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"time"

	"faryne.dev/model/enum"
	taipowerRepo "faryne.dev/repository/taipower"
	"faryne.dev/service/client"
)

// neighborCurrentRulesFilter 同時確認名稱正規化及用途分類已使用目前版本。
func neighborCurrentRulesFilter() map[string]any {
	return map[string]any{"bool": map[string]any{"must": []map[string]any{
		{"term": map[string]any{"normalization_version": neighborNormalizationVersion}},
		{"term": map[string]any{"purpose_rule_version": neighborPurposeRuleVersion}},
	}}}
}

// createNeighborRebuildIndex 建立 cash 為 double 的新索引；舊索引持續服務查詢。
func createNeighborRebuildIndex(ctx context.Context) (string, error) {
	indexName := fmt.Sprintf("%s_v2_%d", neighborIndexName, time.Now().UTC().UnixNano())
	es := client.GetElasticSearch(enum.ESDefault)
	if es == nil {
		return "", fmt.Errorf("elasticsearch client is not initialized")
	}
	response, err := es.Indices.Create(indexName, es.Indices.Create.WithContext(ctx), es.Indices.Create.WithBody(bytes.NewBufferString(neighborRebuildMapping)))
	if err != nil {
		return "", err
	}
	defer response.Body.Close()
	if response.IsError() {
		content, _ := io.ReadAll(response.Body)
		return "", fmt.Errorf("create neighbor rebuild index: status=%s body=%s", response.Status(), content)
	}
	return indexName, nil
}

// validateNeighborRebuildIndex 完成主庫全量回填後，先檢查新索引的筆數、月份、總額及規則版本。
func validateNeighborRebuildIndex(ctx context.Context, indexName string) error {
	db, err := taipowerRepo.NewNeighborRepository().Summary()
	if err != nil {
		return err
	}
	index, err := neighborIndexSummary(ctx, indexName)
	if err != nil {
		return err
	}
	return validateNeighborSummaries(db, index)
}

// neighborAliasActions 把移除舊實體索引與新增 alias 放在同一次原子操作。
func neighborAliasActions(oldIndex, newIndex string) []map[string]any {
	actions := make([]map[string]any, 0, 2)
	if oldIndex != "" {
		// 舊名稱目前可能是 concrete index，也可能是上一版的 alias target；兩者都可原子移除。
		actions = append(actions, map[string]any{"remove_index": map[string]any{"index": oldIndex}})
	}
	return append(actions, map[string]any{"add": map[string]any{"index": newIndex, "alias": neighborIndexName}})
}

// promoteNeighborRebuildIndex 以單次 alias 更新移除舊索引並切到已驗證的新索引。
func promoteNeighborRebuildIndex(ctx context.Context, indexName string) error {
	es := client.GetElasticSearch(enum.ESDefault)
	if es == nil {
		return fmt.Errorf("elasticsearch client is not initialized")
	}
	oldIndex, err := currentNeighborConcreteIndex(ctx)
	if err != nil {
		return err
	}
	var body bytes.Buffer
	if err := json.NewEncoder(&body).Encode(map[string]any{"actions": neighborAliasActions(oldIndex, indexName)}); err != nil {
		return err
	}
	response, err := es.Indices.UpdateAliases(&body, es.Indices.UpdateAliases.WithContext(ctx))
	if err != nil {
		return err
	}
	defer response.Body.Close()
	content, err := io.ReadAll(response.Body)
	if err != nil {
		return err
	}
	if response.StatusCode < http.StatusOK || response.StatusCode >= http.StatusMultipleChoices {
		return fmt.Errorf("promote neighbor index: status=%s body=%s", response.Status(), content)
	}
	var result struct {
		Acknowledged bool `json:"acknowledged"`
		Errors       bool `json:"errors"`
	}
	if err := json.Unmarshal(content, &result); err != nil {
		return err
	}
	if !result.Acknowledged || result.Errors {
		return fmt.Errorf("promote neighbor index incomplete: body=%s", content)
	}
	return nil
}

// currentNeighborConcreteIndex 取得 alias 指向的單一實體索引；首輪部署時回傳同名舊索引。
func currentNeighborConcreteIndex(ctx context.Context) (string, error) {
	es := client.GetElasticSearch(enum.ESDefault)
	response, err := es.Indices.GetAlias(es.Indices.GetAlias.WithContext(ctx), es.Indices.GetAlias.WithName(neighborIndexName))
	if err != nil {
		return "", err
	}
	defer response.Body.Close()
	if response.StatusCode == http.StatusNotFound {
		exists, err := es.Indices.Exists([]string{neighborIndexName}, es.Indices.Exists.WithContext(ctx))
		if err != nil {
			return "", err
		}
		defer exists.Body.Close()
		if exists.StatusCode == http.StatusNotFound {
			return "", nil
		}
		if exists.IsError() {
			content, _ := io.ReadAll(exists.Body)
			return "", fmt.Errorf("check neighbor index: status=%s body=%s", exists.Status(), content)
		}
		return neighborIndexName, nil
	}
	content, err := io.ReadAll(response.Body)
	if err != nil {
		return "", err
	}
	if response.IsError() {
		return "", fmt.Errorf("read neighbor alias: status=%s body=%s", response.Status(), content)
	}
	var indices map[string]json.RawMessage
	if err := json.Unmarshal(content, &indices); err != nil {
		return "", err
	}
	if len(indices) != 1 {
		return "", fmt.Errorf("neighbor alias points to %d indices; expected one", len(indices))
	}
	for index := range indices {
		return index, nil
	}
	return "", nil
}
