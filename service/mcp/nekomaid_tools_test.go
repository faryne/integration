package mcp

import (
	"context"
	"testing"

	nekomaidModel "faryne.dev/model/entity/nekomaid"
	nekomaidService "faryne.dev/service/nekomaid"
	nekomaidRetrieve "faryne.dev/service/nekomaid/retrieve"
	"github.com/stretchr/testify/require"
)

func TestNekomaidRetrieveUsesExistingService(t *testing.T) {
	var site, artworkID string
	server := newBareServer("test-server", "test-version")
	server.registerNekomaidToolsWithDependencies(nekomaidToolDependencies{
		search: func(nekomaidService.SearchRequest) (*nekomaidModel.ArtworkSearchResponse, error) {
			return &nekomaidModel.ArtworkSearchResponse{}, nil
		},
		retrieve: func(_ context.Context, inputSite, inputArtworkID string) (*nekomaidRetrieve.Result, error) {
			site, artworkID = inputSite, inputArtworkID
			return &nekomaidRetrieve.Result{Status: "created", URL: "https://neko.maid.tw/pixiv/456/123"}, nil
		},
	})

	result := callTool(t, server, "nekomaid_retrieve", map[string]interface{}{
		"site": "pixiv", "artwork_id": "123",
	})

	require.False(t, result.IsError)
	require.Equal(t, "pixiv", site)
	require.Equal(t, "123", artworkID)
	require.JSONEq(t, `{"status":"created","url":"https://neko.maid.tw/pixiv/456/123"}`, result.Content[0].Text)
}
