package mediaworker

import (
	"encoding/json"
	"log"
)

// auditRequest 同時回傳可寫入對話 JSONL 的安全紀錄，並在 provider 回錯時保留 dev log；不得傳入認證 header。
func auditRequest(provider, method, endpoint string, payload map[string]any) *RequestAudit {
	audit := &RequestAudit{Method: method, Endpoint: endpoint, Payload: payload}
	if raw, err := json.Marshal(audit); err == nil {
		log.Printf("media worker request provider=%s request=%s", provider, raw)
	}
	return audit
}
