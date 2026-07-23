package mcp

import (
	"context"
	"errors"
	"time"

	storytellerModel "faryne.dev/model/entity/storyteller"
	storytellerService "faryne.dev/service/storyteller"
)

// storytellerMCPContextKey 用來把已通過 PAT 驗證的 userID／寫入來源標記塞進
// context，讓底下的 tool handler 可以取用；不透過 middleware 直接帶參數是因為
// ToolHandler 簽章統一只有 (ctx, arguments)，這是唯一能跨 controller 傳遞身分的管道。
type storytellerMCPContextKey struct{}
type storytellerMCPSourceContextKey struct{}

var errStorytellerMCPUnauthenticated = errors.New("missing authenticated storyteller user")

// storytellerContentSyntaxHint 描述編輯器實際支援的語法子集（不是完整 GFM，見
// wysiwygCore/parser.ts／whitelist.ts），只列「能用什麼」，不列「不能用什麼」——
// 沒提到的語法（表格、code block、待辦清單、~~刪除線~~、標準 [text](url) 連結等）
// 目前解析器不認得，寫了會原樣顯示成文字，故意不在這裡列出來，agent 自然不會去用。
const storytellerContentSyntaxHint = "Content uses this app's own limited markdown-like syntax, not full GFM: " +
	"headings (# through ######), **bold**, *italic*, ++underline++, ^superscript^, ~subscript~, " +
	"blockquote (> text), bullet list (- item), and ordered list (1. item). Anything else is a plain paragraph."

func WithStorytellerUserID(ctx context.Context, userID uint64) context.Context {
	return context.WithValue(ctx, storytellerMCPContextKey{}, userID)
}

func storytellerUserIDFromContext(ctx context.Context) (uint64, error) {
	userID, ok := ctx.Value(storytellerMCPContextKey{}).(uint64)
	if !ok || userID == 0 {
		return 0, errStorytellerMCPUnauthenticated
	}
	return userID, nil
}

// WithStorytellerSource 帶入這次寫入要記在 story/lore version 裡的來源標記，
// 慣例是 "mcp:<token label>"，讓編輯歷史看得出是哪把 Personal Access Token 寫的。
func WithStorytellerSource(ctx context.Context, source string) context.Context {
	return context.WithValue(ctx, storytellerMCPSourceContextKey{}, source)
}

func storytellerSourceFromContext(ctx context.Context) string {
	source, _ := ctx.Value(storytellerMCPSourceContextKey{}).(string)
	if source == "" {
		return "mcp"
	}
	return source
}

// NewStorytellerServer 建立一個只掛 storyteller CRUD 工具的獨立 server 實例，
// 不共用預設 /mcp 的 av/nekomaid 工具，也刻意不碰 AI Agent 相關功能
// （呼叫端本身就是 AI，不需要巢狀呼叫站內的 provider key）。
func NewStorytellerServer(name, version string) *Server {
	s := newBareServer(name, version)
	s.registerBuiltInTools()
	s.registerStorytellerTools()
	return s
}

type storytellerProjectSummary struct {
	PublicID    string    `json:"public_id"`
	Name        string    `json:"name"`
	Slug        string    `json:"slug"`
	Description string    `json:"description"`
	Visibility  string    `json:"visibility"`
	Rating      string    `json:"rating"`
	Tags        []string  `json:"tags"`
	UpdatedAt   time.Time `json:"updated_at"`
}

type storytellerStorySummary struct {
	PublicID  string    `json:"public_id"`
	Title     string    `json:"title"`
	Summary   string    `json:"summary"`
	Status    string    `json:"status"`
	Sort      int       `json:"sort"`
	WordCount uint      `json:"word_count"`
	UpdatedAt time.Time `json:"updated_at"`
}

type storytellerLoreSummary struct {
	PublicID  string    `json:"public_id"`
	Title     string    `json:"title"`
	WordCount uint      `json:"word_count"`
	UpdatedAt time.Time `json:"updated_at"`
}

type storytellerProjectDetail struct {
	storytellerProjectSummary
	Stories []storytellerStorySummary `json:"stories"`
	Lores   []storytellerLoreSummary  `json:"lores"`
}

type storytellerStoryDetail struct {
	storytellerStorySummary
	Content string `json:"content"`
	// VersionID 是這次回傳內容對應的版本 id，寫回時帶成 base_version_id 可以讓後端
	// 檢查內容有沒有被別的呼叫端動過（例如網頁編輯頁同時在編輯）。
	VersionID uint64 `json:"version_id"`
	// VersionConflict 只在 upsert 時可能為 true：代表帶入的 base_version_id 已經
	// 不是最新版本，但內容依然照常寫入、接在最新版本後面，沒有被拒絕或蓋掉；
	// 建議重新呼叫 storyteller_get_story 確認有沒有需要一併處理的內容。
	VersionConflict bool `json:"version_conflict,omitempty"`
}

type storytellerLoreDetail struct {
	storytellerLoreSummary
	Content         string `json:"content"`
	VersionID       uint64 `json:"version_id"`
	VersionConflict bool   `json:"version_conflict,omitempty"`
}

func toStorytellerProjectSummary(project storytellerModel.ProjectOutput) storytellerProjectSummary {
	return storytellerProjectSummary{
		PublicID:    project.PublicID,
		Name:        project.Name,
		Slug:        project.Slug,
		Description: project.Description,
		Visibility:  string(project.Visibility),
		Rating:      string(project.Rating),
		Tags:        project.TagList,
		UpdatedAt:   project.UpdatedAt,
	}
}

func toStorytellerStorySummary(story storytellerModel.Story) storytellerStorySummary {
	return storytellerStorySummary{
		PublicID:  story.PublicID,
		Title:     story.Title,
		Summary:   story.Summary,
		Status:    string(story.Status),
		Sort:      story.Sort,
		WordCount: story.WordCount,
		UpdatedAt: story.UpdatedAt,
	}
}

func toStorytellerLoreSummary(lore storytellerModel.Lore) storytellerLoreSummary {
	return storytellerLoreSummary{
		PublicID:  lore.PublicID,
		Title:     lore.Title,
		WordCount: lore.WordCount,
		UpdatedAt: lore.UpdatedAt,
	}
}

type storytellerProjectArguments struct {
	ProjectPublicID string `json:"project_public_id"`
}

type storytellerStoryArguments struct {
	ProjectPublicID string `json:"project_public_id"`
	StoryPublicID   string `json:"story_public_id"`
}

type storytellerUpsertStoryArguments struct {
	ProjectPublicID string  `json:"project_public_id"`
	StoryPublicID   string  `json:"story_public_id"`
	Title           string  `json:"title"`
	Summary         string  `json:"summary"`
	Status          string  `json:"status"`
	Sort            int     `json:"sort"`
	Content         string  `json:"content"`
	BaseVersionID   *uint64 `json:"base_version_id"`
}

type storytellerLoreArguments struct {
	ProjectPublicID string `json:"project_public_id"`
	LorePublicID    string `json:"lore_public_id"`
}

type storytellerUpsertLoreArguments struct {
	ProjectPublicID string  `json:"project_public_id"`
	LorePublicID    string  `json:"lore_public_id"`
	Title           string  `json:"title"`
	Content         string  `json:"content"`
	BaseVersionID   *uint64 `json:"base_version_id"`
}

func (s *Server) registerStorytellerTools() {
	_ = s.RegisterTool(Tool{
		Name:        "storyteller_list_projects",
		Description: "List the authenticated user's storyteller writing projects.",
		InputSchema: objectSchema(nil, nil),
		Handler: func(ctx context.Context, arguments map[string]interface{}) (*CallToolResult, error) {
			userID, err := storytellerUserIDFromContext(ctx)
			if err != nil {
				return nil, err
			}
			projects, err := storytellerService.NewService().Projects(userID)
			if err != nil {
				return nil, err
			}
			summaries := make([]storytellerProjectSummary, 0, len(projects))
			for _, project := range projects {
				summaries = append(summaries, toStorytellerProjectSummary(project))
			}
			return jsonTextResult(summaries)
		},
	})

	_ = s.RegisterTool(Tool{
		Name:        "storyteller_get_project",
		Description: "Get a project's detail, including its story and lore lists (titles/summaries only, use storyteller_get_story or storyteller_get_lore for full content).",
		InputSchema: objectSchema(map[string]interface{}{
			"project_public_id": stringSchema("Project public_id, as returned by storyteller_list_projects."),
		}, []string{"project_public_id"}),
		Handler: func(ctx context.Context, arguments map[string]interface{}) (*CallToolResult, error) {
			userID, err := storytellerUserIDFromContext(ctx)
			if err != nil {
				return nil, err
			}
			var args storytellerProjectArguments
			if err := decodeArguments(arguments, &args); err != nil {
				return nil, err
			}
			service := storytellerService.NewService()
			project, err := service.Project(userID, args.ProjectPublicID)
			if err != nil {
				return nil, err
			}
			lores, err := service.Lores(userID, args.ProjectPublicID)
			if err != nil {
				return nil, err
			}
			storySummaries := make([]storytellerStorySummary, 0, len(project.Stories))
			for _, story := range project.Stories {
				storySummaries = append(storySummaries, toStorytellerStorySummary(story))
			}
			loreSummaries := make([]storytellerLoreSummary, 0, len(lores))
			for _, lore := range lores {
				loreSummaries = append(loreSummaries, toStorytellerLoreSummary(lore))
			}
			return jsonTextResult(storytellerProjectDetail{
				storytellerProjectSummary: toStorytellerProjectSummary(*project),
				Stories:                   storySummaries,
				Lores:                     loreSummaries,
			})
		},
	})

	_ = s.RegisterTool(Tool{
		Name: "storyteller_get_story",
		Description: "Get a story's full content by project_public_id and story_public_id. " +
			"The returned version_id should be kept and passed back as base_version_id on storyteller_upsert_story " +
			"to detect if someone else (e.g. the web editor) changed the story in the meantime.",
		InputSchema: objectSchema(map[string]interface{}{
			"project_public_id": stringSchema("Project public_id."),
			"story_public_id":   stringSchema("Story public_id, as returned by storyteller_get_project."),
		}, []string{"project_public_id", "story_public_id"}),
		Handler: func(ctx context.Context, arguments map[string]interface{}) (*CallToolResult, error) {
			userID, err := storytellerUserIDFromContext(ctx)
			if err != nil {
				return nil, err
			}
			var args storytellerStoryArguments
			if err := decodeArguments(arguments, &args); err != nil {
				return nil, err
			}
			story, err := storytellerService.NewService().Story(userID, args.ProjectPublicID, args.StoryPublicID)
			if err != nil {
				return nil, err
			}
			return jsonTextResult(storytellerStoryDetail{
				storytellerStorySummary: toStorytellerStorySummary(*story),
				Content:                 story.LatestContent,
				VersionID:               derefUint64(story.LatestVersionID),
			})
		},
	})

	_ = s.RegisterTool(Tool{
		Name: "storyteller_upsert_story",
		Description: "Create or update a story. Omit story_public_id to create a new story; " +
			"pass an existing story_public_id to overwrite its content (this creates a new version, the previous content is not lost). " +
			"Pass base_version_id (from storyteller_get_story) to detect if someone else's edit (e.g. from the web editor) happened " +
			"in the meantime: the write always succeeds and is saved as a new version either way, but the response's " +
			"version_conflict is true if the story had moved on past base_version_id — consider re-fetching with " +
			"storyteller_get_story afterwards to check nothing important got lost.",
		InputSchema: objectSchema(map[string]interface{}{
			"project_public_id": stringSchema("Project public_id."),
			"story_public_id":   stringSchema("Existing story public_id to update. Omit to create a new story."),
			"title":             stringSchema("Story title, required."),
			"summary":           stringSchema("Short summary shown in listings."),
			"status":            stringSchema("draft or completed, defaults to completed."),
			"sort":              integerSchema("Display order among the project's stories."),
			"content":           stringSchema("Full story content. " + storytellerContentSyntaxHint),
			"base_version_id":   integerSchema("Optional. The version_id you last read via storyteller_get_story; the response's version_conflict flags if the story has moved on since, but the write still always happens."),
		}, []string{"project_public_id", "title"}),
		Handler: func(ctx context.Context, arguments map[string]interface{}) (*CallToolResult, error) {
			userID, err := storytellerUserIDFromContext(ctx)
			if err != nil {
				return nil, err
			}
			var args storytellerUpsertStoryArguments
			if err := decodeArguments(arguments, &args); err != nil {
				return nil, err
			}
			input := storytellerModel.StoryRequest{
				Title:         args.Title,
				Summary:       args.Summary,
				Status:        storytellerModel.StoryStatus(args.Status),
				Sort:          args.Sort,
				Content:       args.Content,
				BaseVersionID: args.BaseVersionID,
			}
			source := storytellerSourceFromContext(ctx)
			service := storytellerService.NewService()
			var story *storytellerModel.Story
			var conflicted bool
			if args.StoryPublicID == "" {
				story, err = service.CreateStory(userID, args.ProjectPublicID, input, source)
			} else {
				story, conflicted, err = service.UpdateStory(userID, args.ProjectPublicID, args.StoryPublicID, input, source)
			}
			if err != nil {
				return nil, err
			}
			return jsonTextResult(storytellerStoryDetail{
				storytellerStorySummary: toStorytellerStorySummary(*story),
				Content:                 story.LatestContent,
				VersionID:               derefUint64(story.LatestVersionID),
				VersionConflict:         conflicted,
			})
		},
	})

	_ = s.RegisterTool(Tool{
		Name:        "storyteller_delete_story",
		Description: "Delete a story by project_public_id and story_public_id.",
		InputSchema: objectSchema(map[string]interface{}{
			"project_public_id": stringSchema("Project public_id."),
			"story_public_id":   stringSchema("Story public_id."),
		}, []string{"project_public_id", "story_public_id"}),
		Handler: func(ctx context.Context, arguments map[string]interface{}) (*CallToolResult, error) {
			userID, err := storytellerUserIDFromContext(ctx)
			if err != nil {
				return nil, err
			}
			var args storytellerStoryArguments
			if err := decodeArguments(arguments, &args); err != nil {
				return nil, err
			}
			if err := storytellerService.NewService().DeleteStory(userID, args.ProjectPublicID, args.StoryPublicID); err != nil {
				return nil, err
			}
			return textResult("deleted"), nil
		},
	})

	_ = s.RegisterTool(Tool{
		Name: "storyteller_get_lore",
		Description: "Get a lore/worldbuilding entry's full content by project_public_id and lore_public_id. " +
			"The returned version_id should be kept and passed back as base_version_id on storyteller_upsert_lore " +
			"to detect if someone else (e.g. the web editor) changed it in the meantime.",
		InputSchema: objectSchema(map[string]interface{}{
			"project_public_id": stringSchema("Project public_id."),
			"lore_public_id":    stringSchema("Lore public_id, as returned by storyteller_get_project."),
		}, []string{"project_public_id", "lore_public_id"}),
		Handler: func(ctx context.Context, arguments map[string]interface{}) (*CallToolResult, error) {
			userID, err := storytellerUserIDFromContext(ctx)
			if err != nil {
				return nil, err
			}
			var args storytellerLoreArguments
			if err := decodeArguments(arguments, &args); err != nil {
				return nil, err
			}
			lore, err := storytellerService.NewService().Lore(userID, args.ProjectPublicID, args.LorePublicID)
			if err != nil {
				return nil, err
			}
			return jsonTextResult(storytellerLoreDetail{
				storytellerLoreSummary: toStorytellerLoreSummary(*lore),
				VersionID:              derefUint64(lore.LatestVersionID),
				Content:                lore.LatestContent,
			})
		},
	})

	_ = s.RegisterTool(Tool{
		Name: "storyteller_upsert_lore",
		Description: "Create or update a lore/worldbuilding entry. Omit lore_public_id to create a new one; " +
			"pass an existing lore_public_id to overwrite its content (this creates a new version, the previous content is not lost). " +
			"Pass base_version_id (from storyteller_get_lore) to detect if someone else's edit happened in the meantime: the write " +
			"always succeeds and is saved as a new version either way, but the response's version_conflict is true if the entry had " +
			"moved on past base_version_id — consider re-fetching with storyteller_get_lore afterwards to check nothing important got lost.",
		InputSchema: objectSchema(map[string]interface{}{
			"project_public_id": stringSchema("Project public_id."),
			"lore_public_id":    stringSchema("Existing lore public_id to update. Omit to create a new entry."),
			"title":             stringSchema("Lore title, required."),
			"content":           stringSchema("Full lore content. " + storytellerContentSyntaxHint),
			"base_version_id":   integerSchema("Optional. The version_id you last read via storyteller_get_lore; the response's version_conflict flags if the entry has moved on since, but the write still always happens."),
		}, []string{"project_public_id", "title"}),
		Handler: func(ctx context.Context, arguments map[string]interface{}) (*CallToolResult, error) {
			userID, err := storytellerUserIDFromContext(ctx)
			if err != nil {
				return nil, err
			}
			var args storytellerUpsertLoreArguments
			if err := decodeArguments(arguments, &args); err != nil {
				return nil, err
			}
			input := storytellerModel.LoreRequest{
				Title:         args.Title,
				Content:       args.Content,
				BaseVersionID: args.BaseVersionID,
			}
			source := storytellerSourceFromContext(ctx)
			service := storytellerService.NewService()
			var lore *storytellerModel.Lore
			var conflicted bool
			var err2 error
			if args.LorePublicID == "" {
				lore, err2 = service.CreateLore(userID, args.ProjectPublicID, input, source)
			} else {
				lore, conflicted, err2 = service.UpdateLore(userID, args.ProjectPublicID, args.LorePublicID, input, source)
			}
			if err2 != nil {
				return nil, err2
			}
			return jsonTextResult(storytellerLoreDetail{
				storytellerLoreSummary: toStorytellerLoreSummary(*lore),
				Content:                lore.LatestContent,
				VersionID:              derefUint64(lore.LatestVersionID),
				VersionConflict:        conflicted,
			})
		},
	})

	_ = s.RegisterTool(Tool{
		Name:        "storyteller_delete_lore",
		Description: "Delete a lore/worldbuilding entry by project_public_id and lore_public_id.",
		InputSchema: objectSchema(map[string]interface{}{
			"project_public_id": stringSchema("Project public_id."),
			"lore_public_id":    stringSchema("Lore public_id."),
		}, []string{"project_public_id", "lore_public_id"}),
		Handler: func(ctx context.Context, arguments map[string]interface{}) (*CallToolResult, error) {
			userID, err := storytellerUserIDFromContext(ctx)
			if err != nil {
				return nil, err
			}
			var args storytellerLoreArguments
			if err := decodeArguments(arguments, &args); err != nil {
				return nil, err
			}
			if err := storytellerService.NewService().DeleteLore(userID, args.ProjectPublicID, args.LorePublicID); err != nil {
				return nil, err
			}
			return textResult("deleted"), nil
		},
	})
}

func derefUint64(v *uint64) uint64 {
	if v == nil {
		return 0
	}
	return *v
}
