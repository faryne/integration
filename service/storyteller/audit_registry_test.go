package storyteller

import (
	"testing"

	auditService "faryne.dev/service/storytelleraudit"
	"github.com/stretchr/testify/require"
)

func TestAuditRegistryCoversAllStorytellerTools(t *testing.T) {
	tools := make([]string, 0)
	for _, registry := range []*ToolRegistry{StorytellerToolRegistry(), StorytellerMCPOnlyToolRegistry()} {
		for _, tool := range registry.All() {
			tools = append(tools, tool.Name)
		}
	}
	require.Empty(t, auditService.CheckCoverage(nil, tools))
}
