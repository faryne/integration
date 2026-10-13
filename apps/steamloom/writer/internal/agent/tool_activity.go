package agent

import (
	"encoding/json"
	"fmt"
	"strings"
)

type streamedTool struct {
	Name   string
	Target string
}

// toolTarget 只保留適合顯示的目標識別，不把完整 arguments 或內容寫進對話紀錄。
func toolTarget(raw ...json.RawMessage) string {
	for _, value := range raw {
		if len(value) == 0 || string(value) == "null" {
			continue
		}
		var input map[string]any
		if json.Unmarshal(value, &input) != nil {
			var encoded string
			if json.Unmarshal(value, &encoded) != nil || json.Unmarshal([]byte(encoded), &input) != nil {
				continue
			}
		}
		for _, key := range []string{"title", "story_title", "lore_title", "name", "story_public_id", "lore_public_id", "asset_public_id", "marker_id", "project_public_id"} {
			if target := strings.TrimSpace(fmt.Sprint(input[key])); target != "" && target != "<nil>" {
				return target
			}
		}
	}
	return ""
}
