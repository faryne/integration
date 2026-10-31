package mcp

import (
	"context"

	avEntity "faryne.dev/model/entity/opendata/av"
	avService "faryne.dev/service/av"
)

type actressSubmitArguments struct {
	Kind   string `json:"kind"`
	Target string `json:"target"`
	avEntity.ActressFields
}

type actressSubmissionStatusArguments struct {
	ID uint64 `json:"id"`
}

// registerAVActressSubmissionTools 女優上稿（新增／修改）與查詢審核結果；核准／否決只在網站管理頁，/mcp 沒有身分
func (s *Server) registerAVActressSubmissionTools() {
	_ = s.RegisterTool(Tool{
		Name: "av_actress_submit",
		Description: "Submit a new AV actress, or an edit to an existing one, for admin review. Approved data appears in av_actress_search. " +
			"For kind=edit, only the fields you pass are changed; other fields keep their current values. " +
			"Creating an actress whose name already exists returns the existing ones as duplicates; the admin may merge the submission into them.",
		InputSchema: objectSchema(map[string]interface{}{
			"kind":        stringEnumSchema("create a new actress, or edit an existing one.", avEntity.SubmissionKindCreate, avEntity.SubmissionKindEdit),
			"target":      stringSchema("Required for edit: the actress name, or \"domain-aid\" (e.g. \"xcity-1234\", \"manual-56\") when several actresses share the name."),
			"name":        stringSchema("Actress name. Required for create."),
			"aliases":     stringArraySchema("Other stage names (not including name). DMM credits like \"Name（Alias、Alias）\" list them in brackets."),
			"kana":        stringSchema("Name in kana."),
			"photo":       stringSchema("Photo URL (http/https)."),
			"height":      integerSchema("Height in cm, 0 = unknown."),
			"bust":        integerSchema("Bust in cm, 0 = unknown."),
			"waist":       integerSchema("Waist in cm, 0 = unknown."),
			"hips":        integerSchema("Hips in cm, 0 = unknown."),
			"cup":         stringSchema("Cup size: AAA, AA, or A-Z."),
			"blood":       stringSchema("Blood type."),
			"born_city":   stringSchema("Birthplace."),
			"birth_year":  integerSchema("Birth year, 0 = unknown."),
			"birth_month": integerSchema("Birth month, 0 = unknown."),
			"birth_day":   integerSchema("Birth day, 0 = unknown."),
			"interests":   stringArraySchema("Hobbies / interests."),
			"links": map[string]interface{}{
				"type":        "array",
				"description": "Reference links shown on the actress page (official X, agency profile, etc.).",
				"items": objectSchema(map[string]interface{}{
					"title": stringSchema("Optional label; the domain is shown when empty."),
					"url":   stringSchema("http/https URL."),
				}, []string{"url"}),
			},
		}, []string{"kind"}),
		Handler: func(ctx context.Context, arguments map[string]interface{}) (*CallToolResult, error) {
			var args actressSubmitArguments
			if err := decodeArguments(arguments, &args); err != nil {
				return nil, err
			}
			// 修改只採用有傳的欄位，其他沿用目前資料
			var present []string
			if args.Kind == avEntity.SubmissionKindEdit {
				present = []string{}
				for _, k := range avEntity.ActressEditableFields {
					if _, ok := arguments[k]; ok {
						present = append(present, k)
					}
				}
			}
			req := avEntity.ActressSubmitRequest{Kind: args.Kind, Target: args.Target, Fields: args.ActressFields}
			result, err := avService.SubmitActress(req, present, avEntity.SubmissionChannelMCP, 0, clientIP(ctx))
			if err != nil {
				return nil, err
			}
			return jsonTextResult(result)
		},
	})

	_ = s.RegisterTool(Tool{
		Name:        "av_actress_submission_status",
		Description: "Check whether an av_actress_submit submission is pending, approved, or rejected (with the rejection reason).",
		InputSchema: objectSchema(map[string]interface{}{
			"id": integerSchema("Submission ID returned by av_actress_submit."),
		}, []string{"id"}),
		Handler: func(_ context.Context, arguments map[string]interface{}) (*CallToolResult, error) {
			var args actressSubmissionStatusArguments
			if err := decodeArguments(arguments, &args); err != nil {
				return nil, err
			}
			status, err := avService.ActressSubmissionStatusByID(args.ID)
			if err != nil {
				return nil, err
			}
			return jsonTextResult(status)
		},
	})
}
