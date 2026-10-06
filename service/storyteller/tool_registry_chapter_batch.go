package storyteller

import (
	"context"
	"fmt"
	"sort"
	"strings"

	storytellerModel "faryne.dev/model/entity/storyteller"
)

// storytellerChapterBatchLimit 是多章讀寫一次最多可帶的章數。
const storytellerChapterBatchLimit = 20

type storytellerChapterReplacementArguments struct {
	MarkerID string `json:"marker_id"`
	Content  string `json:"content"`
}

type storytellerGetChaptersArguments struct {
	ProjectPublicID string   `json:"project_public_id"`
	StoryPublicID   string   `json:"story_public_id"`
	LorePublicID    string   `json:"lore_public_id"`
	MarkerIDs       []string `json:"marker_ids"`
}

type storytellerReplaceChaptersArguments struct {
	ProjectPublicID string                                   `json:"project_public_id"`
	StoryPublicID   string                                   `json:"story_public_id"`
	LorePublicID    string                                   `json:"lore_public_id"`
	Chapters        []storytellerChapterReplacementArguments `json:"chapters"`
	BaseVersionID   *uint64                                  `json:"base_version_id"`
}

type storytellerChaptersWriteOutput struct {
	// Chapters 順序同傳入的 chapters，是改完後各章的摘要
	Chapters        []storytellerChapterSummary `json:"chapters"`
	VersionID       uint64                      `json:"version_id"`
	VersionConflict bool                        `json:"version_conflict,omitempty"`
	// FormatWarnings 檢查的是存檔後的整篇內容
	FormatWarnings *[]storyFormatWarning `json:"format_warnings"`
}

// storytellerChapterBatchReadToolSpecs 是一次讀多章；跟多章寫入一起只給外部 MCP client。
func storytellerChapterBatchReadToolSpecs() []ToolSpec {
	return []ToolSpec{
		{
			Name:        "storyteller_get_story_chapters",
			Description: fmt.Sprintf("Get several story chapters (1 to %d) by marker_id in one call, in the requested order. Fails if any marker_id is not found. Each chapter is shaped like storyteller_get_story_chapter's output.", storytellerChapterBatchLimit),
			InputSchema: objectSchema(map[string]interface{}{
				"project_public_id": stringSchema("Project public_id."),
				"story_public_id":   stringSchema("Story public_id."),
				"marker_ids":        stringArraySchema("Heading marker_ids from storyteller_list_story_chapters."),
			}, []string{"project_public_id", "story_public_id", "marker_ids"}),
			Handler: func(ctx context.Context, arguments map[string]interface{}) (interface{}, error) {
				return getStorytellerChapters(ctx, arguments, false)
			},
		},
		{
			Name:        "storyteller_get_lore_chapters",
			Description: fmt.Sprintf("Get several lore chapters (1 to %d) by marker_id in one call, in the requested order. Fails if any marker_id is not found. Each chapter is shaped like storyteller_get_lore_chapter's output.", storytellerChapterBatchLimit),
			InputSchema: objectSchema(map[string]interface{}{
				"project_public_id": stringSchema("Project public_id."),
				"lore_public_id":    stringSchema("Lore public_id."),
				"marker_ids":        stringArraySchema("Heading marker_ids from storyteller_list_lore_chapters."),
			}, []string{"project_public_id", "lore_public_id", "marker_ids"}),
			Handler: func(ctx context.Context, arguments map[string]interface{}) (interface{}, error) {
				return getStorytellerChapters(ctx, arguments, true)
			},
		},
	}
}

// storytellerChapterBatchWriteToolSpecs 跟單章寫入工具一樣只給外部 MCP client，整批只存一個版本。
func storytellerChapterBatchWriteToolSpecs() []ToolSpec {
	chaptersSchema := map[string]interface{}{
		"type":        "array",
		"description": fmt.Sprintf("Required. 1 to %d chapters to replace; each marker_id may appear only once.", storytellerChapterBatchLimit),
		"minItems":    1,
		"maxItems":    storytellerChapterBatchLimit,
		"items": objectSchema(map[string]interface{}{
			"marker_id": stringSchema("Heading marker_id of the chapter to replace."),
			"content":   stringSchema("New full chapter content, including its heading line. " + storytellerContentSyntaxHint + " " + storytellerContentMarkerHint),
		}, []string{"marker_id", "content"}),
	}
	description := "Replace several %s chapters in one call, saved as ONE new version. " +
		"Every item is validated first (content must start with a heading line, marker_id must exist, no duplicate marker_id); if any fails, nothing is written and the error names chapters[i]. " +
		"Content before the first heading is not a chapter and cannot be targeted. Output chapters are in the same order as the input."
	return []ToolSpec{
		{
			Name:        "storyteller_replace_story_chapters",
			Description: fmt.Sprintf(description, "story"),
			InputSchema: objectSchema(map[string]interface{}{
				"project_public_id": stringSchema("Project public_id."),
				"story_public_id":   stringSchema("Story public_id."),
				"chapters":          chaptersSchema,
				"base_version_id":   integerSchema("Optional. The version_id you last read via storyteller_get_story or storyteller_get_story_chapter(s); version_conflict flags if the story has moved on since, but the write still happens."),
			}, []string{"project_public_id", "story_public_id", "chapters"}),
			Handler: func(ctx context.Context, arguments map[string]interface{}) (interface{}, error) {
				return replaceStorytellerChapters(ctx, arguments, false)
			},
		},
		{
			Name:        "storyteller_replace_lore_chapters",
			Description: fmt.Sprintf(description, "lore"),
			InputSchema: objectSchema(map[string]interface{}{
				"project_public_id": stringSchema("Project public_id."),
				"lore_public_id":    stringSchema("Lore public_id."),
				"chapters":          chaptersSchema,
				"base_version_id":   integerSchema("Optional. The version_id you last read via storyteller_get_lore or storyteller_get_lore_chapter(s); version_conflict flags if the lore has moved on since, but the write still happens."),
			}, []string{"project_public_id", "lore_public_id", "chapters"}),
			Handler: func(ctx context.Context, arguments map[string]interface{}) (interface{}, error) {
				return replaceStorytellerChapters(ctx, arguments, true)
			},
		},
	}
}

func getStorytellerChapters(ctx context.Context, arguments map[string]interface{}, isLore bool) (interface{}, error) {
	userID, err := storytellerUserIDFromContext(ctx)
	if err != nil {
		return nil, err
	}
	var args storytellerGetChaptersArguments
	if err := decodeArguments(arguments, &args); err != nil {
		return nil, err
	}
	if len(args.MarkerIDs) == 0 || len(args.MarkerIDs) > storytellerChapterBatchLimit {
		return nil, fmt.Errorf("marker_ids must contain 1 to %d items", storytellerChapterBatchLimit)
	}
	content, versionID, err := loadStorytellerChapterTarget(userID, args.ProjectPublicID, args.StoryPublicID, args.LorePublicID, isLore)
	if err != nil {
		return nil, err
	}
	chapters := make([]storytellerChapterDetail, 0, len(args.MarkerIDs))
	for _, markerID := range args.MarkerIDs {
		chapter, err := storytellerChapterDetailByMarker(content, markerID, versionID)
		if err != nil {
			return nil, err
		}
		chapters = append(chapters, chapter)
	}
	return chapters, nil
}

func replaceStorytellerChapters(ctx context.Context, arguments map[string]interface{}, isLore bool) (interface{}, error) {
	userID, err := storytellerUserIDFromContext(ctx)
	if err != nil {
		return nil, err
	}
	var args storytellerReplaceChaptersArguments
	if err := decodeArguments(arguments, &args); err != nil {
		return nil, err
	}
	service := NewService()
	source := storytellerSourceFromContext(ctx)
	var saved string
	var versionID *uint64
	var conflicted bool
	var startLines []int
	if isLore {
		current, err := service.Lore(userID, args.ProjectPublicID, args.LorePublicID)
		if err != nil {
			return nil, err
		}
		next, starts, err := replaceStoryChaptersContent(current.LatestContent, args.Chapters)
		if err != nil {
			return nil, err
		}
		lore, c, err := service.UpdateLore(userID, args.ProjectPublicID, args.LorePublicID, storytellerModel.LoreRequest{Title: current.Title, Content: next, BaseVersionID: args.BaseVersionID}, source)
		if err != nil {
			return nil, err
		}
		saved, versionID, conflicted, startLines = lore.LatestContent, lore.LatestVersionID, c, starts
	} else {
		current, err := service.Story(userID, args.ProjectPublicID, args.StoryPublicID)
		if err != nil {
			return nil, err
		}
		next, starts, err := replaceStoryChaptersContent(current.LatestContent, args.Chapters)
		if err != nil {
			return nil, err
		}
		story, c, err := service.UpdateStory(userID, args.ProjectPublicID, args.StoryPublicID, storytellerModel.StoryRequest{
			Title:         current.Title,
			Summary:       current.Summary,
			Status:        current.Status,
			Sort:          current.Sort,
			Content:       next,
			BaseVersionID: args.BaseVersionID,
			ContentType:   current.ContentType,
		}, source)
		if err != nil {
			return nil, err
		}
		saved, versionID, conflicted, startLines = story.LatestContent, story.LatestVersionID, c, starts
	}
	summaries, err := storytellerChapterSummariesAtLines(saved, startLines)
	if err != nil {
		return nil, err
	}
	return storytellerChaptersWriteOutput{
		Chapters:        summaries,
		VersionID:       derefUint64(versionID),
		VersionConflict: conflicted,
		FormatWarnings:  storyFormatWarningsAfterSave(saved),
	}, nil
}

func loadStorytellerChapterTarget(userID uint64, projectPublicID, storyPublicID, lorePublicID string, isLore bool) (string, uint64, error) {
	service := NewService()
	if isLore {
		lore, err := service.Lore(userID, projectPublicID, lorePublicID)
		if err != nil {
			return "", 0, err
		}
		return lore.LatestContent, derefUint64(lore.LatestVersionID), nil
	}
	story, err := service.Story(userID, projectPublicID, storyPublicID)
	if err != nil {
		return "", 0, err
	}
	return story.LatestContent, derefUint64(story.LatestVersionID), nil
}

// replaceStoryChaptersContent 一次替換多章：先全部驗證，再「由下往上」套用，前面的章改了行數
// 也不會讓後面還沒套用的章位置跑掉。回傳新內容，以及每章（順序同 chapters）改完後的起始行。
// 章節 span 是平的（每個標題到下一個標題為止），不同 marker_id 不會互相包含。
func replaceStoryChaptersContent(content string, chapters []storytellerChapterReplacementArguments) (string, []int, error) {
	if len(chapters) == 0 || len(chapters) > storytellerChapterBatchLimit {
		return "", nil, fmt.Errorf("chapters must contain 1 to %d items", storytellerChapterBatchLimit)
	}
	allSpans := storyChapterSpans(content)
	spans := make([]storyChapterSpan, len(chapters))
	seen := make(map[string]bool, len(chapters))
	for i, chapter := range chapters {
		if err := validateChapterContentStartsWithHeading(chapter.Content); err != nil {
			return "", nil, fmt.Errorf("chapters[%d]: %w", i, err)
		}
		span, _, ok := findStoryChapterSpan(allSpans, chapter.MarkerID)
		if !ok {
			return "", nil, fmt.Errorf("chapters[%d]: %w", i, errStoryChapterNotFound(chapter.MarkerID))
		}
		if seen[span.MarkerID] {
			return "", nil, fmt.Errorf("chapters[%d]: duplicate marker_id %q", i, span.MarkerID)
		}
		seen[span.MarkerID] = true
		spans[i] = span
	}

	order := make([]int, len(chapters))
	for i := range order {
		order[i] = i
	}
	sort.Slice(order, func(a, b int) bool { return spans[order[a]].StartLine > spans[order[b]].StartLine })
	for _, i := range order {
		content, _ = replaceStoryChapterContent(content, spans[i], chapters[i].Content)
	}

	// 改完後的起始行＝原起始行＋上方被替換章節的行數增減
	startLines := make([]int, len(chapters))
	for i := range chapters {
		startLines[i] = spans[i].StartLine
		for j := range chapters {
			if spans[j].StartLine < spans[i].StartLine {
				startLines[i] += strings.Count(chapters[j].Content, "\n") + 1 - (spans[j].EndLine - spans[j].StartLine)
			}
		}
	}
	return content, startLines, nil
}

// storytellerChapterSummariesAtLines 依起始行找出存檔後各章的摘要。
func storytellerChapterSummariesAtLines(content string, startLines []int) ([]storytellerChapterSummary, error) {
	lines := strings.Split(content, "\n")
	byLine := make(map[int]storytellerChapterSummary)
	for order, span := range storyChapterSpans(content) {
		byLine[span.StartLine] = storytellerChapterSummaryForSpan(lines, span, order)
	}
	summaries := make([]storytellerChapterSummary, 0, len(startLines))
	for _, line := range startLines {
		summary, ok := byLine[line]
		if !ok {
			return nil, fmt.Errorf("saved chapter heading could not be found at line %d", line)
		}
		summaries = append(summaries, summary)
	}
	return summaries, nil
}
