package storytelleraudit

import storytellerModel "faryne.dev/model/entity/storyteller"

func OutcomeForHTTPStatus(status int) storytellerModel.AuditOutcome {
	if status == 401 || status == 403 {
		return storytellerModel.AuditOutcomeDenied
	}
	return storytellerModel.AuditOutcomeFailed
}

// FailureSummary 不接受 error message，避免驗證錯誤把 request 內容帶進稽核資料。
func FailureSummary(status int, customCode string) storytellerModel.AuditSummary {
	return storytellerModel.AuditSummary{
		"http_status": status, "custom_code": customCode, "error_category": HTTPErrorCategory(status),
	}
}

func HTTPErrorCategory(status int) string {
	switch {
	case status == 401 || status == 403:
		return "authorization"
	case status == 400 || status == 422:
		return "validation"
	case status == 404:
		return "not_found"
	case status == 409:
		return "conflict"
	case status >= 500:
		return "internal"
	default:
		return "request"
	}
}

func ToolFailureSummary(outcome storytellerModel.AuditOutcome) storytellerModel.AuditSummary {
	category := "tool_execution"
	if outcome == storytellerModel.AuditOutcomeDenied {
		category = "authorization"
	}
	return storytellerModel.AuditSummary{"error_category": category}
}
