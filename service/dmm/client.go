package dmm

import (
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"reflect"
	"strings"
)

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
	resp, _ := http.DefaultClient.Do(req)
	defer resp.Body.Close()

	content, _ := io.ReadAll(resp.Body)
	if err := json.Unmarshal(content, out); err != nil {
		return err
	}
	return nil

}
