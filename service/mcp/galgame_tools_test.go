package mcp

import (
	"context"
	"encoding/json"
	"testing"

	"faryne.dev/model/entity/eroge"
	"github.com/stretchr/testify/require"
)

type fakeGalgameSubmissionService struct {
	channelUserID uint64
	videoUserID   uint64
	channels      []string
	videos        []string
}

func (s *fakeGalgameSubmissionService) SubmitBrands(_ context.Context, userID uint64, channels []string) ([]eroge.BrandSubmissionResult, error) {
	s.channelUserID, s.channels = userID, channels
	return []eroge.BrandSubmissionResult{{Input: channels[0], Created: true}}, nil
}

func (s *fakeGalgameSubmissionService) SubmitVideos(_ context.Context, userID uint64, urls []string) ([]eroge.VideoSubmissionResult, error) {
	s.videoUserID, s.videos = userID, urls
	return []eroge.VideoSubmissionResult{{Input: urls[0], Created: true}}, nil
}

type fakeGalgameCatalogService struct {
	brandInput eroge.BrandSearchRequest
	videoBrand string
	videoInput eroge.VideoSearchRequest
}

func (s *fakeGalgameCatalogService) SearchBrands(input eroge.BrandSearchRequest) ([]eroge.BrandOutput, int64, error) {
	s.brandInput = input
	return []eroge.BrandOutput{{PublicID: "brand-public-id", Name: "測試頻道"}}, 1, nil
}

func (s *fakeGalgameCatalogService) SearchVideos(brand string, input eroge.VideoSearchRequest) ([]eroge.VideoOutput, int64, error) {
	s.videoBrand, s.videoInput = brand, input
	return []eroge.VideoOutput{{Video: eroge.Video{YouTubeVideoID: "video-id", Title: "測試影片"}}}, 1, nil
}

func TestNewServerRegistersGalgameTools(t *testing.T) {
	server := NewServer("test-server", "test-version")

	list, shouldReply, err := server.HandleJSONRPC(context.Background(), []byte(`{"jsonrpc":"2.0","id":1,"method":"tools/list"}`))
	require.NoError(t, err)
	require.True(t, shouldReply)
	require.Nil(t, list.Error)

	body := mustMarshal(t, list.Result)
	for _, name := range []string{"galgame_submit_channels", "galgame_submit_videos", "galgame_search"} {
		require.Contains(t, body, `"name":"`+name+`"`)
	}
	require.Contains(t, body, `"enum":["videos","channels"]`)
}

func TestGalgameSubmissionToolsUseExistingSubmissionService(t *testing.T) {
	submissions := &fakeGalgameSubmissionService{}
	server := newGalgameTestServer(submissions, &fakeGalgameCatalogService{})

	channels := callTool(t, server, "galgame_submit_channels", map[string]interface{}{
		"channels": []string{"https://www.youtube.com/@example"},
	})
	require.False(t, channels.IsError)
	require.Zero(t, submissions.channelUserID)
	require.Equal(t, []string{"https://www.youtube.com/@example"}, submissions.channels)
	require.JSONEq(t, `[{"input":"https://www.youtube.com/@example","created":true}]`, channels.Content[0].Text)

	videos := callTool(t, server, "galgame_submit_videos", map[string]interface{}{
		"urls": []string{"https://youtu.be/video-id"},
	})
	require.False(t, videos.IsError)
	require.Zero(t, submissions.videoUserID)
	require.Equal(t, []string{"https://youtu.be/video-id"}, submissions.videos)
	require.JSONEq(t, `[{"input":"https://youtu.be/video-id","created":true}]`, videos.Content[0].Text)
}

func TestGalgameSearchMapsWebsiteFilters(t *testing.T) {
	catalog := &fakeGalgameCatalogService{}
	server := newGalgameTestServer(&fakeGalgameSubmissionService{}, catalog)

	result := callTool(t, server, "galgame_search", map[string]interface{}{
		"kind": "videos", "keyword": "demo", "brand_public_id": " brand-id ",
		"published_at_from": "2026-01-01", "published_at_to": "2026-02-01", "page": 2, "per_page": 10,
	})
	require.False(t, result.IsError)
	require.Equal(t, "brand-id", catalog.videoBrand)
	require.Equal(t, int64(2), catalog.videoInput.Page)
	require.Equal(t, int64(10), catalog.videoInput.PerPage)
	require.Equal(t, "demo", catalog.videoInput.Keyword)
	require.Equal(t, "2026-01-01", catalog.videoInput.PublishedAtFrom)
	var output struct {
		Kind    string              `json:"kind"`
		Total   int64               `json:"total"`
		Page    int64               `json:"page"`
		PerPage int64               `json:"per_page"`
		Data    []eroge.VideoOutput `json:"data"`
	}
	require.NoError(t, json.Unmarshal([]byte(result.Content[0].Text), &output))
	require.Equal(t, "videos", output.Kind)
	require.Equal(t, int64(1), output.Total)
	require.Equal(t, int64(2), output.Page)
	require.Equal(t, int64(10), output.PerPage)
	require.Equal(t, "video-id", output.Data[0].YouTubeVideoID)
}

func TestGalgameSearchRejectsChannelOnlyInvalidFilters(t *testing.T) {
	server := newGalgameTestServer(&fakeGalgameSubmissionService{}, &fakeGalgameCatalogService{})
	result := callTool(t, server, "galgame_search", map[string]interface{}{
		"kind": "channels", "published_at_from": "2026-01-01",
	})
	require.True(t, result.IsError)
	require.Contains(t, result.Content[0].Text, "only valid when kind is videos")
}

func newGalgameTestServer(submissions galgameSubmissionService, catalog galgameCatalogService) *Server {
	server := newBareServer("test-server", "test-version")
	server.registerGalgameToolsWithDependencies(galgameToolDependencies{
		newSubmissionService: func(context.Context) (galgameSubmissionService, error) { return submissions, nil },
		newCatalogService:    func() galgameCatalogService { return catalog },
	})
	return server
}

func callTool(t *testing.T, server *Server, name string, arguments map[string]interface{}) CallToolResult {
	t.Helper()
	params, err := json.Marshal(map[string]interface{}{"name": name, "arguments": arguments})
	require.NoError(t, err)
	body, err := json.Marshal(map[string]interface{}{
		"jsonrpc": "2.0", "id": 1, "method": "tools/call", "params": json.RawMessage(params),
	})
	require.NoError(t, err)
	response, shouldReply, err := server.HandleJSONRPC(context.Background(), body)
	require.NoError(t, err)
	require.True(t, shouldReply)
	require.Nil(t, response.Error)
	encoded, err := json.Marshal(response.Result)
	require.NoError(t, err)
	var result CallToolResult
	require.NoError(t, json.Unmarshal(encoded, &result))
	return result
}
