package nccc

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"

	"faryne.dev/model/enum"
	"faryne.dev/service/client"
	"faryne.dev/service/log"
	"go.uber.org/zap"
)

type ClearIndexResult struct {
	DataSet string `json:"dataset"`
	Index   string `json:"index"`
	Deleted int64  `json:"deleted"`
}

type deleteByQueryResponse struct {
	Deleted int64 `json:"deleted"`
}

func RunClearIndexes() {
	results, err := ClearIndexes(context.Background())
	if err != nil {
		log.Logger().Error("NCCC clear indexes failed: " + err.Error())
		return
	}
	totalDeleted := int64(0)
	for _, result := range results {
		totalDeleted += result.Deleted
	}
	log.Logger().Info("NCCC clear indexes finished",
		zap.Int("indexes", len(results)),
		zap.Int64("deleted", totalDeleted),
	)
}

func ClearIndexes(ctx context.Context) ([]ClearIndexResult, error) {
	results := make([]ClearIndexResult, 0, len(dataSets))
	for _, dataSetKey := range dataSetKeys() {
		indexName := ncccIndexName(dataSetKey)
		deleted, err := clearIndex(ctx, indexName)
		if err != nil {
			return results, err
		}
		results = append(results, ClearIndexResult{
			DataSet: dataSetKey,
			Index:   indexName,
			Deleted: deleted,
		})
		log.Logger().Info("NCCC index cleared",
			zap.String("dataset", dataSetKey),
			zap.String("index", indexName),
			zap.Int64("deleted", deleted),
		)
	}
	return results, nil
}

func clearIndex(ctx context.Context, indexName string) (int64, error) {
	es := client.GetElasticSearch(enum.ESDefault)
	if es == nil {
		return 0, fmt.Errorf("elasticsearch client is not initialized")
	}

	body := bytes.NewBufferString(`{"query":{"match_all":{}}}`)
	resp, err := es.DeleteByQuery(
		[]string{indexName},
		body,
		es.DeleteByQuery.WithContext(ctx),
		es.DeleteByQuery.WithRefresh(true),
		es.DeleteByQuery.WithConflicts("proceed"),
	)
	if err != nil {
		return 0, err
	}
	defer resp.Body.Close()

	responseBody, err := io.ReadAll(resp.Body)
	if err != nil {
		return 0, err
	}
	if resp.StatusCode == http.StatusNotFound {
		return 0, nil
	}
	if resp.StatusCode < http.StatusOK || resp.StatusCode >= http.StatusMultipleChoices {
		return 0, fmt.Errorf("clear %s failed: status=%s body=%s", indexName, resp.Status(), responseBody)
	}

	var result deleteByQueryResponse
	if err := json.Unmarshal(responseBody, &result); err != nil {
		return 0, err
	}
	return result.Deleted, nil
}

func ncccIndexName(dataSetKey string) string {
	return "nccc_" + dataSetKey
}
