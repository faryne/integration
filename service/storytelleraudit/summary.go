package storytelleraudit

import (
	"encoding/json"
	"reflect"

	storytellerModel "faryne.dev/model/entity/storyteller"
)

var projectDiffFields = []string{"name", "slug", "description", "visibility", "rating", "tags", "cover_asset_public_id", "cover_layout", "cover_focal_point"}

// ProjectDiff 只比較明確允許的公開欄位；share_token、內部 key 與全文永遠不會進 summary。
func ProjectDiff(before, after any) storytellerModel.AuditSummary {
	changed := ChangedFields(before, after, projectDiffFields...)
	if len(changed) == 0 {
		return nil
	}
	return storytellerModel.AuditSummary{"changes": changed}
}

func ChangedFields(before, after any, fields ...string) map[string]any {
	beforeMap, afterMap := jsonObject(before), jsonObject(after)
	changed := make(map[string]any)
	for _, field := range fields {
		if !reflect.DeepEqual(beforeMap[field], afterMap[field]) {
			changed[field] = map[string]any{"before": beforeMap[field], "after": afterMap[field]}
		}
	}
	return changed
}

// SafeSummary 從參數與結果擷取識別碼、版本與列表筆數，不複製 content／description 等文字。
func SafeSummary(arguments map[string]any, result any) storytellerModel.AuditSummary {
	summary := storytellerModel.AuditSummary{}
	for _, key := range []string{
		"project_public_id", "story_public_id", "lore_public_id", "asset_public_id",
		"collection_public_id", "collection_id", "volume_public_id", "parent_id", "marker_id", "after_marker_id",
		"target_version_id", "version_id", "base_version_id", "sort", "page", "page_size",
	} {
		if value, ok := arguments[key]; ok && value != nil && value != "" {
			summary[key] = value
		}
	}
	resultMap := jsonObject(result)
	for _, key := range []string{"public_id", "latest_version_id", "version_id", "collection_id", "total_count", "story_count", "lore_count", "page", "page_size"} {
		if value, ok := resultMap[key]; ok && value != nil {
			summary[key] = value
		}
	}
	if count, ok := resultCount(result, resultMap); ok {
		summary["count"] = count
	}
	if len(summary) == 0 {
		return nil
	}
	return summary
}

func resultCount(result any, object map[string]any) (int, bool) {
	for _, key := range []string{"projects", "stories", "lores", "assets", "collections", "volumes", "versions", "chapters", "memories", "profiles"} {
		if rows, ok := object[key].([]any); ok {
			return len(rows), true
		}
	}
	value := reflect.ValueOf(result)
	if value.IsValid() && (value.Kind() == reflect.Slice || value.Kind() == reflect.Array) {
		return value.Len(), true
	}
	return 0, false
}

func jsonObject(value any) map[string]any {
	data, err := json.Marshal(value)
	if err != nil {
		return map[string]any{}
	}
	var output map[string]any
	if json.Unmarshal(data, &output) != nil || output == nil {
		return map[string]any{}
	}
	return output
}
