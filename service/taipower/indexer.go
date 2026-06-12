package taipower

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strconv"

	"faryne.dev/model/entity/opendata/taipower"
	"faryne.dev/model/enum"
	"faryne.dev/service/client"
)

const neighborIndexName = "taipower_neighbor"

type neighborBulkResponse struct {
	Errors bool `json:"errors"`
	Items  []map[string]struct {
		ID     string `json:"_id"`
		Status int    `json:"status"`
		Error  any    `json:"error"`
	} `json:"items"`
}

func indexNeighbors(ctx context.Context, items []taipower.Neighbor) error {
	if len(items) == 0 {
		return nil
	}

	es := client.GetElasticSearch(enum.ESDefault)
	if es == nil {
		return fmt.Errorf("elasticsearch client is not initialized")
	}

	var body bytes.Buffer
	encoder := json.NewEncoder(&body)
	for _, item := range items {
		meta := map[string]any{
			"index": map[string]any{
				"_index": neighborIndexName,
				"_id":    strconv.FormatUint(uint64(item.ID), 10),
			},
		}
		if err := encoder.Encode(meta); err != nil {
			return err
		}
		if err := encoder.Encode(item); err != nil {
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
		return fmt.Errorf("bulk index %s failed: status=%s body=%s", neighborIndexName, resp.Status(), responseBody)
	}

	var result neighborBulkResponse
	if err := json.Unmarshal(responseBody, &result); err != nil {
		return err
	}
	if !result.Errors {
		return nil
	}
	for _, operation := range result.Items {
		for _, item := range operation {
			if item.Status >= http.StatusMultipleChoices {
				return fmt.Errorf(
					"bulk index %s document %s failed: status=%d error=%v",
					neighborIndexName,
					item.ID,
					item.Status,
					item.Error,
				)
			}
		}
	}
	return fmt.Errorf("bulk index %s failed with unknown item error", neighborIndexName)
}
