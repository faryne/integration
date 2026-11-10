package taipower

import (
	"bytes"
	"context"
	"fmt"
	"io"
	"net/http"

	"faryne.dev/model/enum"
	"faryne.dev/service/client"
)

const neighborKeyMapping = `{"properties":{"cityarea_key":{"type":"keyword"},"unit_key":{"type":"keyword"},"purpose_key":{"type":"keyword"},"normalization_version":{"type":"keyword"},"purpose_rule_version":{"type":"keyword"}}}`

// ensureNeighborIndexMapping 在寫入衍生欄位前明確設定 keyword mapping。
func ensureNeighborIndexMapping(ctx context.Context) error {
	es := client.GetElasticSearch(enum.ESDefault)
	if es == nil {
		return fmt.Errorf("elasticsearch client is not initialized")
	}
	exists, err := es.Indices.Exists([]string{neighborIndexName}, es.Indices.Exists.WithContext(ctx))
	if err != nil {
		return err
	}
	defer exists.Body.Close()
	if exists.StatusCode == http.StatusNotFound {
		response, err := es.Indices.Create(neighborIndexName, es.Indices.Create.WithContext(ctx), es.Indices.Create.WithBody(bytes.NewBufferString(`{"mappings":`+neighborKeyMapping+`}`)))
		if err != nil {
			return err
		}
		defer response.Body.Close()
		if response.IsError() {
			body, _ := io.ReadAll(response.Body)
			return fmt.Errorf("create neighbor index: %s", body)
		}
		return nil
	}
	if exists.IsError() {
		body, _ := io.ReadAll(exists.Body)
		return fmt.Errorf("check neighbor index: %s", body)
	}
	response, err := es.Indices.PutMapping(bytes.NewBufferString(neighborKeyMapping), es.Indices.PutMapping.WithContext(ctx), es.Indices.PutMapping.WithIndex(neighborIndexName))
	if err != nil {
		return err
	}
	defer response.Body.Close()
	if response.IsError() {
		body, _ := io.ReadAll(response.Body)
		return fmt.Errorf("map neighbor keys: %s", body)
	}
	return nil
}
