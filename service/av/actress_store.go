package av

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"

	"faryne.dev/config"
	avEntity "faryne.dev/model/entity/opendata/av"
	"faryne.dev/model/enum"
	"faryne.dev/service/client"
)

// ErrActressWritesDisabled 本機用正式索引名時不寫 ES（本機與正式環境共用 ES cluster）
var ErrActressWritesDisabled = errors.New("actress index writes are disabled outside production; set DMM_ACTRESS_INDEX to a test index")

// actressIndexName 女優索引名稱，本機測試可用 DMM_ACTRESS_INDEX 蓋成別的名字
func actressIndexName() string {
	return config.EnvConfig().DMMActressIndex
}

// actressWritesAllowed 正式環境，或本機改用測試索引時才寫 ES（比照影片的 videoWritesAllowed）
func actressWritesAllowed() bool {
	cfg := config.EnvConfig()
	return cfg.IsProduction() || cfg.DMMActressIndex != "dmmactresses"
}

// putActressDocument 寫一筆女優文件；_id 固定是 {domain}-{aid}，重複寫入就是覆蓋
func putActressDocument(ctx context.Context, doc actressIndexDocument, refresh string) error {
	es := client.GetElasticSearch(enum.ESDefault)
	if es == nil {
		return fmt.Errorf("elasticsearch client is not initialized")
	}
	body, err := json.Marshal(doc)
	if err != nil {
		return err
	}
	resp, err := es.Index(
		actressIndexName(),
		bytes.NewReader(body),
		es.Index.WithContext(ctx),
		es.Index.WithDocumentID(fmt.Sprintf("%s-%d", doc.Domain, doc.AID)),
		es.Index.WithRefresh(refresh),
	)
	if err != nil {
		return err
	}
	defer resp.Body.Close()
	if resp.StatusCode < http.StatusOK || resp.StatusCode >= http.StatusMultipleChoices {
		return fmt.Errorf("index av actress failed: status=%s aid=%d name=%s", resp.Status(), doc.AID, doc.Name)
	}
	return nil
}

// actressRowFields 解開 dmm_actresses.info（已套用過覆寫，就是目前顯示的資料）
func actressRowFields(row avEntity.DMMActress) avEntity.ActressFields {
	var f avEntity.ActressFields
	_ = json.Unmarshal([]byte(row.Info), &f)
	f.Interests, f.Links = nonNil(f.Interests), nonNil(f.Links)
	return f
}
