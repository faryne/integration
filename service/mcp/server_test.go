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
	require.Contains(t, mustMarshal(t, list.Result), `"name":"nekomaid_retrieve"`)

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
		"storyteller_search_replace_story_batch",
		"storyteller_search_replace_lore_batch",
		"storyteller_search_project",
		"storyteller_get_story_chapters",
		"storyteller_get_lore_chapters",
		"storyteller_replace_story_chapters",
		"storyteller_replace_lore_chapters",
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

func TestNewStorytellerServerRegistersProjectWriteTools(t *testing.T) {
	server := NewStorytellerServer("storyteller-test", "test-version")

	list, shouldReply, err := server.HandleJSONRPC(context.Background(), []byte(`{"jsonrpc":"2.0","id":1,"method":"tools/list"}`))
	require.NoError(t, err)
	require.True(t, shouldReply)
	require.Nil(t, list.Error)

	body := mustMarshal(t, list.Result)
	require.Contains(t, body, `"name":"storyteller_create_project"`)
	require.Contains(t, body, `"name":"storyteller_patch_project"`)
}

func TestNewStorytellerServerRegistersMemoryTools(t *testing.T) {
	server := NewStorytellerServer("storyteller-test", "test-version")

	list, shouldReply, err := server.HandleJSONRPC(context.Background(), []byte(`{"jsonrpc":"2.0","id":1,"method":"tools/list"}`))
	require.NoError(t, err)
	require.True(t, shouldReply)
	require.Nil(t, list.Error)

	body := mustMarshal(t, list.Result)
	require.Contains(t, body, `"name":"storyteller_list_memories"`)
	require.Contains(t, body, `"name":"storyteller_search_memories"`)
	require.Contains(t, body, `"name":"storyteller_upsert_memory"`)
	require.Contains(t, body, "story_public_id")
	require.Contains(t, body, "lore_public_id")
}

// storyteller server 要在 initialize 帶出使用引導；預設 /mcp server 不帶（見 TestServerHandleJSONRPCHandlesBasicMCPMethods）。
func TestNewStorytellerServerReturnsInstructions(t *testing.T) {
	server := NewStorytellerServer("storyteller-test", "test-version")

	initialize, shouldReply, err := server.HandleJSONRPC(context.Background(), []byte(`{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2024-11-05"}}`))
	require.NoError(t, err)
	require.True(t, shouldReply)
	require.Nil(t, initialize.Error)

	var result struct {
		Instructions string `json:"instructions"`
	}
	require.NoError(t, json.Unmarshal([]byte(mustMarshal(t, initialize.Result)), &result))
	require.Contains(t, result.Instructions, "storyteller_list_memories")
	require.Contains(t, result.Instructions, "storyteller_upsert_memory")
}

func mustMarshal(t *testing.T, v interface{}) string {
	t.Helper()
	body, err := json.Marshal(v)
	require.NoError(t, err)
	return string(body)
}

// Storyteller MCP 的 serverInfo 要帶 title／websiteUrl／icons，給 connector 列表顯示 Steamloom 圖示。
func TestStorytellerServerAdvertisesIdentity(t *testing.T) {
	server := NewStorytellerServer("steamloom.works", "http")
	initialize, _, err := server.HandleJSONRPC(context.Background(), []byte(`{"jsonrpc":"2.0","id":1,"method":"initialize"}`))
	require.NoError(t, err)
	var result struct {
		ServerInfo struct {
			Name       string `json:"name"`
			Title      string `json:"title"`
			WebsiteURL string `json:"websiteUrl"`
			Icons      []struct {
				Src      string `json:"src"`
				MimeType string `json:"mimeType"`
			} `json:"icons"`
		} `json:"serverInfo"`
	}
	require.NoError(t, json.Unmarshal([]byte(mustMarshal(t, initialize.Result)), &result))
	require.Equal(t, "steamloom.works", result.ServerInfo.Name)
	require.Equal(t, "Steamloom", result.ServerInfo.Title)
	require.Equal(t, "https://steamloom.works", result.ServerInfo.WebsiteURL)
	require.Equal(t, "image/png", result.ServerInfo.Icons[0].MimeType)
}
