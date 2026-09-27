package storytelleraudit

import (
	"testing"

	storytellerModel "faryne.dev/model/entity/storyteller"
	"github.com/stretchr/testify/require"
)

func TestCheckCoverage(t *testing.T) {
	routes := []storytellerModel.AuditRouteRef{
		{Method: "POST", Path: "/storyteller/projects"},
		{Method: "POST", Path: "/storyteller/projects/project-1/assets/presign"},
		{Method: "PATCH", Path: "/storyteller/projects/:project/missing"},
		{Method: "GET", Path: "/storyteller/projects"},
	}
	tools := []string{"storyteller_get_project", "storyteller_presign_asset_upload", "storyteller_unknown"}

	require.Equal(t, []string{
		"route PATCH /storyteller/projects/:project/missing",
		"route POST /storyteller/projects/project-1/assets/presign",
		"tool storyteller_unknown",
	}, CheckCoverage(routes, tools))
}
