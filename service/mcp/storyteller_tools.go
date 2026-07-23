package mcp

import (
	"context"
	"errors"
	"time"

	storytellerModel "faryne.dev/model/entity/storyteller"
	storytellerService "faryne.dev/service/storyteller"
)

// storytellerMCPContextKey 用來把已通過 PAT 驗證的 userID 塞進 context，讓底下的
// tool handler 可以取用；不透過 middleware 直接帶參數是因為 ToolHandler 簽章統一
// 只有 (ctx, arguments)，這是唯一能跨 controller 傳遞身分的管道。
type storytellerMCPContextKey struct{}

var errStorytellerMCPUnauthenticated = errors.New("missing authenticated storyteller user")

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
}

type storytellerLoreDetail struct {
	storytellerLoreSummary
	Content string `json:"content"`
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
	ProjectPublicID string `json:"project_public_id"`
	StoryPublicID   string `json:"story_public_id"`
	Title           string `json:"title"`
	Summary         string `json:"summary"`
	Status          string `json:"status"`
	Sort            int    `json:"sort"`
	Content         string `json:"content"`
}

type storytellerLoreArguments struct {
	ProjectPublicID string `json:"project_public_id"`
	LorePublicID    string `json:"lore_public_id"`
}

type storytellerUpsertLoreArguments struct {
	ProjectPublicID string `json:"project_public_id"`
	LorePublicID    string `json:"lore_public_id"`
	Title           string `json:"title"`
	Content         string `json:"content"`
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
		Name:        "storyteller_get_story",
		Description: "Get a story's full content by project_public_id and story_public_id.",
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
			})
		},
	})

	_ = s.RegisterTool(Tool{
		Name: "storyteller_upsert_story",
		Description: "Create or update a story. Omit story_public_id to create a new story; " +
			"pass an existing story_public_id to overwrite its content (this creates a new version, the previous content is not lost).",
		InputSchema: objectSchema(map[string]interface{}{
			"project_public_id": stringSchema("Project public_id."),
			"story_public_id":   stringSchema("Existing story public_id to update. Omit to create a new story."),
			"title":             stringSchema("Story title, required."),
			"summary":           stringSchema("Short summary shown in listings."),
			"status":            stringSchema("draft or completed, defaults to completed."),
			"sort":              integerSchema("Display order among the project's stories."),
			"content":           stringSchema("Full story content in markdown."),
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
				Title:   args.Title,
				Summary: args.Summary,
				Status:  storytellerModel.StoryStatus(args.Status),
				Sort:    args.Sort,
				Content: args.Content,
			}
			service := storytellerService.NewService()
			var story *storytellerModel.Story
			if args.StoryPublicID == "" {
				story, err = service.CreateStory(userID, args.ProjectPublicID, input)
			} else {
				story, err = service.UpdateStory(userID, args.ProjectPublicID, args.StoryPublicID, input)
			}
			if err != nil {
				return nil, err
			}
			return jsonTextResult(storytellerStoryDetail{
				storytellerStorySummary: toStorytellerStorySummary(*story),
				Content:                 story.LatestContent,
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
		Name:        "storyteller_get_lore",
		Description: "Get a lore/worldbuilding entry's full content by project_public_id and lore_public_id.",
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
				Content:                lore.LatestContent,
			})
		},
	})

	_ = s.RegisterTool(Tool{
		Name: "storyteller_upsert_lore",
		Description: "Create or update a lore/worldbuilding entry. Omit lore_public_id to create a new one; " +
			"pass an existing lore_public_id to overwrite its content (this creates a new version, the previous content is not lost).",
		InputSchema: objectSchema(map[string]interface{}{
			"project_public_id": stringSchema("Project public_id."),
			"lore_public_id":    stringSchema("Existing lore public_id to update. Omit to create a new entry."),
			"title":             stringSchema("Lore title, required."),
			"content":           stringSchema("Full lore content in markdown."),
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
				Title:   args.Title,
				Content: args.Content,
			}
			service := storytellerService.NewService()
			var lore *storytellerModel.Lore
			var err2 error
			if args.LorePublicID == "" {
				lore, err2 = service.CreateLore(userID, args.ProjectPublicID, input)
			} else {
				lore, err2 = service.UpdateLore(userID, args.ProjectPublicID, args.LorePublicID, input)
			}
			if err2 != nil {
				return nil, err2
			}
			return jsonTextResult(storytellerLoreDetail{
				storytellerLoreSummary: toStorytellerLoreSummary(*lore),
				Content:                lore.LatestContent,
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
