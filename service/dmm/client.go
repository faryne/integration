package dmm

import (
	"encoding/json"
	"fmt"
	"net/http"
	"reflect"
	"strings"

	"faryne.dev/service/helper"
)

// graphQLErrorResponse 只取 GraphQL 回應中的 errors，用來判斷查詢是否失敗
type graphQLErrorResponse struct {
	Errors []struct {
		Message string `json:"message"`
	} `json:"errors"`
}

func (i *DMM) send(query string, variables map[string]interface{}, out any) error {
	if reflect.ValueOf(out).Kind() != reflect.Ptr {
		return fmt.Errorf("out must be a pointer")
	}
	payload := map[string]interface{}{
		"query":     query,
		"variables": variables,
	}

	jsonPayload, _ := json.Marshal(payload)
	postBody := strings.NewReader(string(jsonPayload))

	req, _ := http.NewRequest(http.MethodPost, "https://api.video.dmm.co.jp/graphql", postBody)
	req.Header.Set("Content-Type", "application/json")

	content, status, err := helper.DoRawWithStatus(req)
	if err != nil {
		return err
	}

	// DMM 改 schema 時會回 422 + errors、data 為 null；不擋下來的話會 unmarshal 出整包 zero value，
	// 下游（ES 匯入）就會把 0001/01/01 這種空資料當正常資料寫進去
	var gqlErr graphQLErrorResponse
	_ = json.Unmarshal(content, &gqlErr)
	if len(gqlErr.Errors) > 0 {
		return fmt.Errorf("dmm graphql error: status=%d message=%s", status, gqlErr.Errors[0].Message)
	}
	if status < http.StatusOK || status >= http.StatusMultipleChoices {
		return fmt.Errorf("dmm graphql unexpected status: %d", status)
	}

	if err := json.Unmarshal(content, out); err != nil {
		return err
	}
	return nil
}
