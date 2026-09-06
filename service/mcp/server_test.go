package mcp

import (
	"context"
	"encoding/json"
	"testing"

	"github.com/stretchr/testify/require"
)

func TestServerHandleJSONRPCHandlesBasicMCPMethods(t *testing.T) {
	server := NewServer("test-server", "test-version")

	var initialize response
	initialize, shouldReply, err := server.HandleJSONRPC(context.Background(), []byte(`{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2024-11-05"}}`))
	require.NoError(t, err)
	require.True(t, shouldReply)
	require.Nil(t, initialize.Error)
	require.JSONEq(t, `{"protocolVersion":"2024-11-05","capabilities":{"tools":{}},"serverInfo":{"name":"test-server","version":"test-version"}}`, mustMarshal(t, initialize.Result))

	_, shouldReply, err = server.HandleJSONRPC(context.Background(), []byte(`{"jsonrpc":"2.0","method":"notifications/initialized"}`))
	require.NoError(t, err)
	require.False(t, shouldReply)

	var list response
	list, shouldReply, err = server.HandleJSONRPC(context.Background(), []byte(`{"jsonrpc":"2.0","id":2,"method":"tools/list"}`))
	require.NoError(t, err)
	require.True(t, shouldReply)
	require.Nil(t, list.Error)
	require.Contains(t, mustMarshal(t, list.Result), `"name":"ping"`)
	require.NotContains(t, mustMarshal(t, list.Result), `"name":"server_info"`)
	require.Contains(t, mustMarshal(t, list.Result), `"name":"nekomaid_search"`)

	var call response
	call, shouldReply, err = server.HandleJSONRPC(context.Background(), []byte(`{"jsonrpc":"2.0","id":3,"method":"tools/call","params":{"name":"ping","arguments":{}}}`))
	require.NoError(t, err)
	require.True(t, shouldReply)
	require.Nil(t, call.Error)
	require.JSONEq(t, `{"content":[{"type":"text","text":"pong"}]}`, mustMarshal(t, call.Result))
}

func TestNewStorytellerServerRegistersPatchAndSearchReplaceTools(t *testing.T) {
	server := NewStorytellerServer("storyteller-test", "test-version")

	list, shouldReply, err := server.HandleJSONRPC(context.Background(), []byte(`{"jsonrpc":"2.0","id":1,"method":"tools/list"}`))
	require.NoError(t, err)
	require.True(t, shouldReply)
	require.Nil(t, list.Error)

	body := mustMarshal(t, list.Result)
	for _, name := range []string{
		"storyteller_patch_story",
		"storyteller_search_replace_story",
		"storyteller_patch_lore",
		"storyteller_search_replace_lore",
	} {
		require.Contains(t, body, `"name":"`+name+`"`)
	}
	require.Contains(t, body, "Omit a field to leave it unchanged")
	require.Contains(t, body, "Go RE2 regexp syntax")
}

func TestNewStorytellerServerRegistersChapterTools(t *testing.T) {
	server := NewStorytellerServer("storyteller-test", "test-version")

	list, shouldReply, err := server.HandleJSONRPC(context.Background(), []byte(`{"jsonrpc":"2.0","id":1,"method":"tools/list"}`))
	require.NoError(t, err)
	require.True(t, shouldReply)
	require.Nil(t, list.Error)

	body := mustMarshal(t, list.Result)
	for _, name := range []string{
		"storyteller_list_story_chapters",
		"storyteller_get_story_chapter",
		"storyteller_replace_story_chapter",
		"storyteller_insert_story_chapter",
		"storyteller_delete_story_chapter",
		"storyteller_list_lore_chapters",
		"storyteller_get_lore_chapter",
		"storyteller_replace_lore_chapter",
		"storyteller_insert_lore_chapter",
		"storyteller_delete_lore_chapter",
	} {
		require.Contains(t, body, `"name":"`+name+`"`)
	}
}

func mustMarshal(t *testing.T, v interface{}) string {
	t.Helper()
	body, err := json.Marshal(v)
	require.NoError(t, err)
	return string(body)
}
