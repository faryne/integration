package mcp

import (
	"context"

	avEntity "faryne.dev/model/entity/opendata/av"
	avService "faryne.dev/service/av"
)

type videoSubmitArguments struct {
	Target string `json:"target"`
	avEntity.VideoFields
}

// registerAVVideoSubmissionTools 影片修改與查詢審核結果；核准／否決只在網站管理頁，/mcp 沒有身分
func (s *Server) registerAVVideoSubmissionTools() {
	_ = s.RegisterTool(Tool{
		Name: "av_video_submit",
		Description: "Submit an edit to an existing AV video for admin review. Approved changes appear in av_video_search and are kept across DMM re-syncs. " +
			"Only the fields you pass are changed; other fields keep their current values. Videos cannot be created. " +
			"Tags must be existing DMM tags (use av_video_search facets to find them). The result lists new_values: values no other video has yet, check them for typos. " +
			"Shares the hourly submission limit with av_actress_submit.",
		InputSchema: objectSchema(map[string]interface{}{
			"target":       stringSchema("The video to edit: maker product code (e.g. \"MDVR-448\") or DMM internal no (e.g. \"mdvr00448\"). Use the internal no when a product code matches several videos."),
			"title":        stringSchema("Title."),
			"maker_no":     stringSchema("Maker product code (e.g. \"MDVR-448\"); enables the MissAV link and becomes the page URL."),
			"vod_date":     stringSchema("Streaming start date, YYYY/MM/DD."),
			"publish_date": stringSchema("Release date, YYYY/MM/DD."),
			"duration":     integerSchema("Length in minutes, 0 = unknown."),
			"actresses":    stringArraySchema("Full cast list (replaces the current list). Stage names or DMM credits like \"Name（Alias）\"."),
			"directors":    stringArraySchema("Full director list (replaces the current list)."),
			"series":       stringArraySchema("Full series list (replaces the current list)."),
			"makers":       stringArraySchema("Full maker list (replaces the current list)."),
			"labels":       stringArraySchema("Full label list (replaces the current list)."),
			"tags":         stringArraySchema("Full tag list (replaces the current list); existing DMM tags only."),
			"links": map[string]interface{}{
				"type":        "array",
				"description": "Reference links shown on the video page (replaces the current list).",
				"items": objectSchema(map[string]interface{}{
					"title": stringSchema("Optional label; the domain is shown when empty."),
					"url":   stringSchema("http/https URL."),
				}, []string{"url"}),
			},
		}, []string{"target"}),
		Handler: func(ctx context.Context, arguments map[string]interface{}) (*CallToolResult, error) {
			var args videoSubmitArguments
			if err := decodeArguments(arguments, &args); err != nil {
				return nil, err
			}
			// 只採用有傳的欄位，其他沿用目前資料
			present := []string{}
			for _, k := range avEntity.VideoEditableFields {
				if _, ok := arguments[k]; ok {
					present = append(present, k)
				}
			}
			req := avEntity.VideoSubmitRequest{Target: args.Target, Fields: args.VideoFields}
			result, err := avService.SubmitVideo(ctx, req, present, avEntity.SubmissionChannelMCP, 0, clientIP(ctx))
			if err != nil {
				return nil, err
			}
			return jsonTextResult(result)
		},
	})

	_ = s.RegisterTool(Tool{
		Name:        "av_video_submission_status",
		Description: "Check whether an av_video_submit submission is pending, approved, or rejected (with the rejection reason).",
		InputSchema: objectSchema(map[string]interface{}{
			"id": integerSchema("Submission ID returned by av_video_submit."),
		}, []string{"id"}),
		Handler: func(_ context.Context, arguments map[string]interface{}) (*CallToolResult, error) {
			var args actressSubmissionStatusArguments
			if err := decodeArguments(arguments, &args); err != nil {
				return nil, err
			}
			status, err := avService.VideoSubmissionStatusByID(args.ID)
			if err != nil {
				return nil, err
			}
			return jsonTextResult(status)
		},
	})
}
