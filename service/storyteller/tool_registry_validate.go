package storyteller

import (
	"context"
	"errors"
	"strings"
)

type storytellerValidateContentArguments struct {
	ProjectPublicID string `json:"project_public_id"`
	Content         string `json:"content"`
	StoryPublicID   string `json:"story_public_id"`
	LorePublicID    string `json:"lore_public_id"`
	ChapterMarkerID string `json:"chapter_marker_id"`
}

// storytellerValidateToolSpecs 只註冊在 MCP 專用清單：名稱不是 get_/list_ 開頭，放進主清單會被
// 站內 AI 助理的 WriteStorytellerToolNames 誤判成需要提案確認的寫入工具。
func storytellerValidateToolSpecs() []ToolSpec {
	return []ToolSpec{
		{
			Name: "storyteller_validate_content",
			Description: "Dry-run format check for story or lore content. Writes nothing. Use it before saving to catch problems that would make the reader page print raw symbols: block prefixes (# heading, > quote, - list) wrapped inside the paragraph marker, unpaired or duplicate paragraph markers, unclosed footnote/comment markers, unclosed code fences, split table rows, GFM ~~strikethrough~~, and asset references that are not in this project. " +
				"Returns ok (false when any error-severity warning would remain after saving), the chapters that storyteller_list_story_chapters will see after saving, and warnings with line numbers and suggestions. " +
				"Pass story_public_id or lore_public_id to also get removed_marker_ids: paragraph ids present in the current version but missing from your content (the author's bookmarks may point at them). " +
				"When content is a single chapter, also pass chapter_marker_id so it is compared with that chapter only, not the whole story. " +
				"Write tools also return format_warnings for the saved content; an empty array means no problems.",
			InputSchema: objectSchema(map[string]interface{}{
				"project_public_id": stringSchema("Project public_id. Asset references in content are checked against this project."),
				"content":           stringSchema("The full content, or one chapter, exactly as you plan to save it."),
				"story_public_id":   stringSchema("Optional. Compare paragraph ids with this story's current version. Mutually exclusive with lore_public_id."),
				"lore_public_id":    stringSchema("Optional. Compare paragraph ids with this lore entry's current version. Mutually exclusive with story_public_id."),
				"chapter_marker_id": stringSchema("Optional. When content is one chapter, the heading marker_id of the chapter it replaces, so only that chapter is compared."),
			}, []string{"project_public_id", "content"}),
			Handler: validateStorytellerContent,
		},
	}
}

func validateStorytellerContent(ctx context.Context, arguments map[string]interface{}) (interface{}, error) {
	userID, err := storytellerUserIDFromContext(ctx)
	if err != nil {
		return nil, err
	}
	var args storytellerValidateContentArguments
	if err := decodeArguments(arguments, &args); err != nil {
		return nil, err
	}
	if args.StoryPublicID != "" && args.LorePublicID != "" {
		return nil, errors.New("pass story_public_id or lore_public_id, not both")
	}
	service := NewService()
	// 查專案同時做授權：只能檢查自己專案的內容與資產
	project, err := service.repo.ProjectByPublicIDForUser(userID, args.ProjectPublicID)
	if err != nil {
		return nil, err
	}

	report := checkStoryContentFormat(args.Content)
	if err := service.validateMarkdownAssetReferences(project.ID, args.Content); err != nil {
		report.Warnings = append(report.Warnings, storyFormatWarning{Code: "invalid_asset_reference", Severity: storyFormatSeverityError,
			Message: "圖片引用有問題，存檔會失敗：" + err.Error()})
		report.OK = false
	}

	previous, err := currentStorytellerContent(service, userID, args)
	if err != nil {
		return nil, err
	}
	if previous != nil {
		if args.ChapterMarkerID != "" {
			span, _, ok := findStoryChapterSpan(storyChapterSpans(*previous), args.ChapterMarkerID)
			if !ok {
				return nil, errStoryChapterNotFound(args.ChapterMarkerID)
			}
			chapter := strings.Join(strings.Split(*previous, "\n")[span.StartLine:span.EndLine], "\n")
			previous = &chapter
		}
		report.RemovedMarkerIDs = removedStoryMarkerIDs(*previous, args.Content)
	}
	return report, nil
}

// currentStorytellerContent 取得要比對的目前版本內容；沒帶 story／lore id 時回傳 nil，代表不比對段落 id。
func currentStorytellerContent(service *Service, userID uint64, args storytellerValidateContentArguments) (*string, error) {
	switch {
	case args.StoryPublicID != "":
		story, err := service.Story(userID, args.ProjectPublicID, args.StoryPublicID)
		if err != nil {
			return nil, err
		}
		return &story.LatestContent, nil
	case args.LorePublicID != "":
		lore, err := service.Lore(userID, args.ProjectPublicID, args.LorePublicID)
		if err != nil {
			return nil, err
		}
		return &lore.LatestContent, nil
	default:
		return nil, nil
	}
}
