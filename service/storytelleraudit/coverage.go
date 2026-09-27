package storytelleraudit

import (
	"fmt"
	"sort"
	"strings"

	storytellerModel "faryne.dev/model/entity/storyteller"
)

func CheckCoverage(routes []storytellerModel.AuditRouteRef, tools []string) []string {
	unmapped := make([]string, 0)
	for _, route := range routes {
		method := strings.ToUpper(route.Method)
		if !isWriteMethod(method) || (!strings.HasPrefix(route.Path, "/storyteller/") && route.Path != "/storyteller-mcp") {
			continue
		}
		identifier := method + " " + route.Path
		if _, ok := storytellerModel.AuditActionForRoute(method, route.Path); !ok && !storytellerModel.IsAuditExempt("route", identifier) {
			unmapped = append(unmapped, fmt.Sprintf("route %s", identifier))
		}
	}
	for _, tool := range tools {
		if _, ok := storytellerModel.AuditActionForTool(tool); !ok && !storytellerModel.IsAuditExempt("tool", tool) {
			unmapped = append(unmapped, "tool "+tool)
		}
	}
	sort.Strings(unmapped)
	return unmapped
}

func isWriteMethod(method string) bool {
	switch method {
	case "POST", "PUT", "PATCH", "DELETE":
		return true
	default:
		return false
	}
}
