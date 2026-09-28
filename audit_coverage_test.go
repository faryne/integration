package main

import (
	"testing"

	storytellerModel "faryne.dev/model/entity/storyteller"
	"faryne.dev/route"
	storytellerService "faryne.dev/service/storyteller"
	auditService "faryne.dev/service/storytelleraudit"
	"github.com/stretchr/testify/require"
)

func TestStorytellerAuditRegistryCoversRoutesAndTools(t *testing.T) {
	app := newApp()
	route.Storyteller(app)
	route.StorytellerMCP(app)
	routes := make([]storytellerModel.AuditRouteRef, 0)
	for _, registered := range app.GetRoutes() {
		routes = append(routes, storytellerModel.AuditRouteRef{Method: registered.Method, Path: registered.Path})
	}
	tools := make([]string, 0)
	for _, registry := range []*storytellerService.ToolRegistry{storytellerService.StorytellerToolRegistry(), storytellerService.StorytellerMCPOnlyToolRegistry()} {
		for _, tool := range registry.All() {
			tools = append(tools, tool.Name)
		}
	}
	require.Empty(t, auditService.CheckCoverage(routes, tools))
}
