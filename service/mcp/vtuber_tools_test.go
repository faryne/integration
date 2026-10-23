package mcp

import (
	"errors"
	"testing"

	"github.com/stretchr/testify/require"

	vtuberEntity "faryne.dev/model/entity/opendata/vtuber"
)

func TestVtuberToolMapsArguments(t *testing.T) {
	var got vtuberEntity.LiveRequest
	server := newBareServer("test-server", "test-version")
	server.registerVtuberToolsWithQuery(func(req vtuberEntity.LiveRequest) (*vtuberEntity.LiveQueryResult, error) {
		got = req
		if req.Status == "bogus" {
			return nil, errors.New("unknown status")
		}
		return &vtuberEntity.LiveQueryResult{}, nil
	})

	result := callTool(t, server, "vtuber_live_query", map[string]interface{}{
		"channel": "宝鐘マリン", "status": "upcoming", "from": "2026-10-23", "to": "2026-10-30T00:00:00Z",
	})
	require.False(t, result.IsError)
	// 關鍵字走 Channel，不是只吃頻道 ID 的 ChannelID
	require.Equal(t, vtuberEntity.LiveRequest{Channel: "宝鐘マリン", Status: "upcoming", From: "2026-10-23", To: "2026-10-30T00:00:00Z"}, got)

	// service 回錯誤時，tool 結果標成錯誤
	bad := callTool(t, server, "vtuber_live_query", map[string]interface{}{"status": "bogus"})
	require.True(t, bad.IsError)
}
