package search

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"strings"

	"faryne.dev/model/enum"
	"faryne.dev/service/client"
)

// ES 專用的小工具：聚合查詢、萬用字元跳脫。改用 Manticore 後（規格 P5）跟這個 package 一起移除

// WildcardEscaper wildcard 查詢的特殊字元要跳脫，使用者輸入的 * ? 才會被當成一般字元
var WildcardEscaper = strings.NewReplacer(`\`, `\\`, `*`, `\*`, `?`, `\?`)

// RegexpEscaper ES regexp 的保留字元，使用者輸入要先跳脫才能放進 terms 的 include
var RegexpEscaper = strings.NewReplacer(
	`\`, `\\`, `.`, `\.`, `?`, `\?`, `+`, `\+`, `*`, `\*`, `|`, `\|`, `{`, `\{`, `}`, `\}`,
	`[`, `\[`, `]`, `\]`, `(`, `\(`, `)`, `\)`, `"`, `\"`, `#`, `\#`, `@`, `\@`, `&`, `\&`,
	`<`, `\<`, `>`, `\>`, `~`, `\~`,
)

// TermsAgg terms aggregation；舊資料常有空字串（系列／發售商），統計時一律排除
func TermsAgg(field string, size int) map[string]any {
	return map[string]any{"terms": map[string]any{"field": field, "size": size, "exclude": ""}}
}

// Raw 對指定索引送一個查詢（聚合、統計這類不需要 hits 的查詢），整包回應解到 out；ES 回錯誤狀態時回 error
func Raw(ctx context.Context, index string, body map[string]any, out any) error {
	es := client.GetElasticSearch(enum.ESDefault)
	if es == nil {
		return fmt.Errorf("elasticsearch client is not initialized")
	}
	buf, err := json.Marshal(body)
	if err != nil {
		return err
	}
	resp, err := es.Search(es.Search.WithContext(ctx), es.Search.WithIndex(index), es.Search.WithBody(bytes.NewReader(buf)))
	if err != nil {
		return err
	}
	defer resp.Body.Close()
	raw, err := io.ReadAll(resp.Body)
	if err != nil {
		return err
	}
	if resp.IsError() {
		return fmt.Errorf("search %s failed: status=%s body=%.300s", index, resp.Status(), raw)
	}
	return json.Unmarshal(raw, out)
}
