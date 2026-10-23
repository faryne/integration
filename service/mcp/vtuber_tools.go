package mcp

import (
	"context"

	vtuberEntity "faryne.dev/model/entity/opendata/vtuber"
	vtuberService "faryne.dev/service/vtuber"
)

type vtuberLiveQueryArguments struct {
	Channel string `json:"channel"`
	Status  string `json:"status"`
	From    string `json:"from"`
	To      string `json:"to"`
}

func (s *Server) registerVtuberTools() {
	s.registerVtuberToolsWithQuery(vtuberService.QueryLives)
}

// registerVtuberToolsWithQuery 讓 MCP 參數轉換可獨立測試，不必連 DB
func (s *Server) registerVtuberToolsWithQuery(query func(vtuberEntity.LiveRequest) (*vtuberEntity.LiveQueryResult, error)) {
	_ = s.RegisterTool(Tool{
		Name: "vtuber_live_query",
		Description: "Query hololive live streams (including premieres) tracked on faryne.dev/data/vtubers. " +
			"Each item has the channel, title, status (upcoming / live / ended / cancelled), scheduled and actual start/end times in UTC, " +
			"and concurrent viewers while live. Defaults to 1 day ago through 14 days later; the range may not exceed 31 days. " +
			"Convert times to the user's timezone when answering (hololive schedules are usually announced in JST).",
		InputSchema: objectSchema(map[string]interface{}{
			"channel": stringSchema("Optional YouTube channel ID, @handle, or part of the channel name, for example 宝鐘マリン or @houshoumarine."),
			"status":  stringEnumSchema("Optional status filter.", vtuberEntity.LiveStatusUpcoming, vtuberEntity.LiveStatusLive, vtuberEntity.LiveStatusEnded, vtuberEntity.LiveStatusCancelled),
			"from":    stringSchema("Optional range start, RFC 3339 or YYYY-MM-DD (Asia/Taipei midnight). Defaults to 1 day ago."),
			"to":      stringSchema("Optional range end, RFC 3339 or YYYY-MM-DD (Asia/Taipei midnight). Defaults to 15 days after from."),
		}, nil),
		Handler: func(ctx context.Context, arguments map[string]interface{}) (*CallToolResult, error) {
			var args vtuberLiveQueryArguments
			if err := decodeArguments(arguments, &args); err != nil {
				return nil, err
			}
			result, err := query(vtuberEntity.LiveRequest{Channel: args.Channel, Status: args.Status, From: args.From, To: args.To})
			if err != nil {
				return nil, err
			}
			return jsonTextResult(result)
		},
	})
}
