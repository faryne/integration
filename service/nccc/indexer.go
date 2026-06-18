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
)

type bulkResponse struct {
	Errors bool `json:"errors"`
	Items  []map[string]struct {
		ID     string `json:"_id"`
		Status int    `json:"status"`
		Error  any    `json:"error"`
	} `json:"items"`
}

func indexDocuments(ctx context.Context, dataSetKey string, documents []map[string]any) error {
	if len(documents) == 0 {
		return nil
	}

	for start := 0; start < len(documents); start += bulkChunkSize {
		end := start + bulkChunkSize
		if end > len(documents) {
			end = len(documents)
		}
		if err := indexDocumentChunk(ctx, dataSetKey, documents[start:end]); err != nil {
			return err
		}
	}
	return nil
}

func indexDocumentChunk(ctx context.Context, dataSetKey string, documents []map[string]any) error {
	es := client.GetElasticSearch(enum.ESDefault)
	if es == nil {
		return fmt.Errorf("elasticsearch client is not initialized")
	}

	indexName := ncccIndexName(dataSetKey)
	var body bytes.Buffer
	encoder := json.NewEncoder(&body)
	for _, document := range documents {
		id, err := documentID(document)
		if err != nil {
			return err
		}
		meta := map[string]any{
			"index": map[string]any{
				"_index": indexName,
				"_id":    id,
			},
		}
		if err := encoder.Encode(meta); err != nil {
			return err
		}
		if err := encoder.Encode(document); err != nil {
			return err
		}
	}

	resp, err := es.Bulk(
		bytes.NewReader(body.Bytes()),
		es.Bulk.WithContext(ctx),
		es.Bulk.WithRefresh("true"),
	)
	if err != nil {
		return err
	}
	defer resp.Body.Close()

	responseBody, err := io.ReadAll(resp.Body)
	if err != nil {
		return err
	}
	if resp.StatusCode < http.StatusOK || resp.StatusCode >= http.StatusMultipleChoices {
		return fmt.Errorf("bulk index %s failed: status=%s body=%s", indexName, resp.Status(), responseBody)
	}

	var result bulkResponse
	if err := json.Unmarshal(responseBody, &result); err != nil {
		return err
	}
	if !result.Errors {
		return nil
	}
	for _, operation := range result.Items {
		for _, item := range operation {
			if item.Status >= http.StatusMultipleChoices {
				return fmt.Errorf("bulk index %s document %s failed: status=%d error=%v", indexName, item.ID, item.Status, item.Error)
			}
		}
	}
	return fmt.Errorf("bulk index %s failed with unknown item error", indexName)
}
