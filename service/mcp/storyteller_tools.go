package mcp

import (
	"context"
	"crypto/rand"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"strings"
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

// storytellerProjectDetailListCap 是 storyteller_get_project 嵌進去的 story/lore
// 清單上限，避免專案很大時單次回應塞爆 agent 的 context；超過的部分要另外呼叫
// storyteller_list_stories/storyteller_list_lores 分頁拉。
const storytellerProjectDetailListCap = 50

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
	PublicID string `json:"public_id"`
	Title    string `json:"title"`
	Summary  string `json:"summary"`
	Status   string `json:"status"`
	Sort     int    `json:"sort"`
	// ContentType 是 "text"（一般文字故事，storyteller_upsert_story／storyteller_get_story
	// 的 content 是文字）或 "image"（話，內容是圖片頁面，改用 storyteller_upsert_image_story
	// 寫入，storyteller_get_story 回應改看 pages 欄位，content 對這種故事是空的）。
	ContentType string    `json:"content_type"`
	WordCount   uint      `json:"word_count"`
	UpdatedAt   time.Time `json:"updated_at"`
}

type storytellerLoreSummary struct {
	PublicID  string    `json:"public_id"`
	Title     string    `json:"title"`
	WordCount uint      `json:"word_count"`
	UpdatedAt time.Time `json:"updated_at"`
}

type storytellerProjectDetail struct {
	storytellerProjectSummary
	// Stories/Lores 最多回 storytellerProjectDetailListCap 筆；StoryCount/LoreCount
	// 是這個專案實際總數，超過上限時代表還有更多，要另外呼叫
	// storyteller_list_stories/storyteller_list_lores 分頁拉。
	Stories    []storytellerStorySummary `json:"stories"`
	StoryCount int64                     `json:"story_count"`
	Lores      []storytellerLoreSummary  `json:"lores"`
	LoreCount  int64                     `json:"lore_count"`
}

type storytellerStoryListOutput struct {
	Stories    []storytellerStorySummary `json:"stories"`
	TotalCount int64                     `json:"total_count"`
	Page       int                       `json:"page"`
	PageSize   int                       `json:"page_size"`
}

type storytellerLoreListOutput struct {
	Lores      []storytellerLoreSummary `json:"lores"`
	TotalCount int64                    `json:"total_count"`
	Page       int                      `json:"page"`
	PageSize   int                      `json:"page_size"`
}

type storytellerStoryDetail struct {
	storytellerStorySummary
	// Content 只有 content_type=text 的故事會填值；content_type=image 的話這欄是空的，
	// 改看 Pages。
	Content string `json:"content,omitempty"`
	// Pages 只有 content_type=image 的故事（話）會填值：每一頁的 id/key/description/sort，
	// 加上簽過名、可以直接開啟查看的 image_url。key 要原樣保留、之後呼叫
	// storyteller_upsert_image_story 更新這一話時要用同一組 key 帶回去，不然這頁會被當
	// 成新頁面處理（其實還是同一個 S3 物件，只是書籤等關聯資料會對不上舊的 id）。
	Pages []storytellerModel.StoryImagePageOutput `json:"pages,omitempty"`
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
		PublicID:    story.PublicID,
		Title:       story.Title,
		Summary:     story.Summary,
		Status:      string(story.Status),
		Sort:        story.Sort,
		ContentType: string(story.ContentType),
		WordCount:   story.WordCount,
		UpdatedAt:   story.UpdatedAt,
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

type storytellerListPageArguments struct {
	ProjectPublicID string `json:"project_public_id"`
	Page            int    `json:"page"`
	PageSize        int    `json:"page_size"`
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

type storytellerPresignImageUploadArguments struct {
	ProjectPublicID string   `json:"project_public_id"`
	ContentTypes    []string `json:"content_types"`
}

type storytellerAssetArguments struct {
	ProjectPublicID string `json:"project_public_id"`
	AssetPublicID   string `json:"asset_public_id"`
}

type storytellerListAssetsArguments struct {
	ProjectPublicID string `json:"project_public_id"`
	CollectionID    string `json:"collection_id"`
	AssetType       string `json:"asset_type"`
	Keyword         string `json:"keyword"`
	Page            int    `json:"page"`
	PageSize        int    `json:"page_size"`
}

type storytellerPresignAssetUploadArguments struct {
	ProjectPublicID string                                    `json:"project_public_id"`
	Files           []storytellerModel.AssetUploadFileRequest `json:"files"`
}

type storytellerConfirmAssetUploadArguments struct {
	ProjectPublicID  string                         `json:"project_public_id"`
	Key              string                         `json:"key"`
	ContentType      string                         `json:"content_type"`
	CollectionID     string                         `json:"collection_id"`
	OriginalFilename string                         `json:"original_filename"`
	Title            string                         `json:"title"`
	AltText          string                         `json:"alt_text"`
	Description      string                         `json:"description"`
	Metadata         storytellerModel.AssetMetadata `json:"metadata"`
}

type storytellerUpdateAssetArguments struct {
	ProjectPublicID string                         `json:"project_public_id"`
	AssetPublicID   string                         `json:"asset_public_id"`
	Title           string                         `json:"title"`
	AltText         string                         `json:"alt_text"`
	Description     string                         `json:"description"`
	Metadata        storytellerModel.AssetMetadata `json:"metadata"`
}

type storytellerMoveAssetArguments struct {
	ProjectPublicID string `json:"project_public_id"`
	AssetPublicID   string `json:"asset_public_id"`
	CollectionID    string `json:"collection_id"`
}

type storytellerAssetCollectionArguments struct {
	ProjectPublicID    string `json:"project_public_id"`
	CollectionPublicID string `json:"collection_public_id"`
}

type storytellerUpsertAssetCollectionArguments struct {
	ProjectPublicID    string `json:"project_public_id"`
	CollectionPublicID string `json:"collection_public_id"`
	Name               string `json:"name"`
	Description        string `json:"description"`
	Sort               int    `json:"sort"`
}

// storytellerImagePageArguments 是 storyteller_upsert_image_story 的單一頁面：Key 一定要是
// storyteller_presign_image_upload 給的 key，且該 key 對應的檔案要先實際 PUT 上傳完成，
// 不然存檔時的檔案大小檢查（HeadObject）會找不到物件而失敗。ID 留空代表新頁面，伺服器
// 會生一個；更新既有話時，既有頁面要把 storyteller_get_story 回傳的 id/key 原樣帶回來，
// 不然這頁會被當成全新頁面（書籤等關聯資料會跟舊的 id 對不上）。頁面順序＝陣列順序，
// 不需要（也不支援）另外帶 sort。
type storytellerImagePageArguments struct {
	ID          string `json:"id"`
	Key         string `json:"key"`
	Description string `json:"description"`
}

type storytellerUpsertImageStoryArguments struct {
	ProjectPublicID string                          `json:"project_public_id"`
	StoryPublicID   string                          `json:"story_public_id"`
	Title           string                          `json:"title"`
	Summary         string                          `json:"summary"`
	Status          string                          `json:"status"`
	Sort            int                             `json:"sort"`
	Pages           []storytellerImagePageArguments `json:"pages"`
	BaseVersionID   *uint64                         `json:"base_version_id"`
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
		Name: "storyteller_get_project",
		Description: fmt.Sprintf(
			"Get a project's detail, including its story and lore lists (titles/summaries only, use storyteller_get_story "+
				"or storyteller_get_lore for full content). Stories/lores are capped at %d each; check story_count/lore_count "+
				"and use storyteller_list_stories/storyteller_list_lores to page through the rest if there are more.",
			storytellerProjectDetailListCap,
		),
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
			stories, storyCount, err := service.StoriesPage(userID, args.ProjectPublicID, 1, storytellerProjectDetailListCap)
			if err != nil {
				return nil, err
			}
			lores, loreCount, err := service.LoresPage(userID, args.ProjectPublicID, 1, storytellerProjectDetailListCap)
			if err != nil {
				return nil, err
			}
			storySummaries := make([]storytellerStorySummary, 0, len(stories))
			for _, story := range stories {
				storySummaries = append(storySummaries, toStorytellerStorySummary(story))
			}
			loreSummaries := make([]storytellerLoreSummary, 0, len(lores))
			for _, lore := range lores {
				loreSummaries = append(loreSummaries, toStorytellerLoreSummary(lore))
			}
			return jsonTextResult(storytellerProjectDetail{
				storytellerProjectSummary: toStorytellerProjectSummary(*project),
				Stories:                   storySummaries,
				StoryCount:                storyCount,
				Lores:                     loreSummaries,
				LoreCount:                 loreCount,
			})
		},
	})

	_ = s.RegisterTool(Tool{
		Name: "storyteller_list_stories",
		Description: "Paginate a project's stories (titles/summaries only, use storyteller_get_story for full content). " +
			"Use this when a project has more stories than storyteller_get_project's embedded list shows (see its story_count).",
		InputSchema: objectSchema(map[string]interface{}{
			"project_public_id": stringSchema("Project public_id."),
			"page":              integerSchema("Page number, starting at 1. Defaults to 1."),
			"page_size":         integerSchema("Items per page, defaults to 20, capped at 100."),
		}, []string{"project_public_id"}),
		Handler: func(ctx context.Context, arguments map[string]interface{}) (*CallToolResult, error) {
			userID, err := storytellerUserIDFromContext(ctx)
			if err != nil {
				return nil, err
			}
			var args storytellerListPageArguments
			if err := decodeArguments(arguments, &args); err != nil {
				return nil, err
			}
			page := normalizedPage(args.Page)
			pageSize := args.PageSize
			if pageSize < 1 {
				pageSize = 20
			}
			stories, total, err := storytellerService.NewService().StoriesPage(userID, args.ProjectPublicID, page, pageSize)
			if err != nil {
				return nil, err
			}
			summaries := make([]storytellerStorySummary, 0, len(stories))
			for _, story := range stories {
				summaries = append(summaries, toStorytellerStorySummary(story))
			}
			return jsonTextResult(storytellerStoryListOutput{
				Stories:    summaries,
				TotalCount: total,
				Page:       page,
				PageSize:   pageSize,
			})
		},
	})

	_ = s.RegisterTool(Tool{
		Name: "storyteller_list_lores",
		Description: "Paginate a project's lore/worldbuilding entries (titles only, use storyteller_get_lore for full content). " +
			"Use this when a project has more lores than storyteller_get_project's embedded list shows (see its lore_count).",
		InputSchema: objectSchema(map[string]interface{}{
			"project_public_id": stringSchema("Project public_id."),
			"page":              integerSchema("Page number, starting at 1. Defaults to 1."),
			"page_size":         integerSchema("Items per page, defaults to 20, capped at 100."),
		}, []string{"project_public_id"}),
		Handler: func(ctx context.Context, arguments map[string]interface{}) (*CallToolResult, error) {
			userID, err := storytellerUserIDFromContext(ctx)
			if err != nil {
				return nil, err
			}
			var args storytellerListPageArguments
			if err := decodeArguments(arguments, &args); err != nil {
				return nil, err
			}
			page := normalizedPage(args.Page)
			pageSize := args.PageSize
			if pageSize < 1 {
				pageSize = 20
			}
			lores, total, err := storytellerService.NewService().LoresPage(userID, args.ProjectPublicID, page, pageSize)
			if err != nil {
				return nil, err
			}
			summaries := make([]storytellerLoreSummary, 0, len(lores))
			for _, lore := range lores {
				summaries = append(summaries, toStorytellerLoreSummary(lore))
			}
			return jsonTextResult(storytellerLoreListOutput{
				Lores:      summaries,
				TotalCount: total,
				Page:       page,
				PageSize:   pageSize,
			})
		},
	})

	_ = s.RegisterTool(Tool{
		Name: "storyteller_get_story",
		Description: "Get a story's full content by project_public_id and story_public_id. " +
			"For content_type=text stories, content holds the story text. For content_type=image stories " +
			"(a \"話\"), content is empty and pages holds each page's id/key/description/sort plus a signed " +
			"image_url you can fetch directly; to create or edit an image story use storyteller_presign_image_upload " +
			"and storyteller_upsert_image_story instead of storyteller_upsert_story. " +
			"The returned version_id should be kept and passed back as base_version_id on storyteller_upsert_story " +
			"(or storyteller_upsert_image_story) to detect if someone else (e.g. the web editor) changed the story " +
			"in the meantime.",
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
			service := storytellerService.NewService()
			story, err := service.Story(userID, args.ProjectPublicID, args.StoryPublicID)
			if err != nil {
				return nil, err
			}
			detail := storytellerStoryDetail{
				storytellerStorySummary: toStorytellerStorySummary(*story),
				VersionID:               derefUint64(story.LatestVersionID),
			}
			if story.ContentType == storytellerModel.ProjectContentTypeImage {
				pages, err := service.ImageStoryPages(userID, args.ProjectPublicID, args.StoryPublicID)
				if err != nil {
					return nil, err
				}
				detail.Pages = pages
			} else {
				detail.Content = story.LatestContent
			}
			return jsonTextResult(detail)
		},
	})

	_ = s.RegisterTool(Tool{
		Name: "storyteller_upsert_story",
		Description: "Create or update a text story (prose content). For image stories (\"話\", a sequence of " +
			"image pages) use storyteller_presign_image_upload + storyteller_upsert_image_story instead — this tool " +
			"always creates content_type=text stories and cannot be used for image content. " +
			"Omit story_public_id to create a new story; " +
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
		Name: "storyteller_presign_image_upload",
		Description: "Step 1 of creating/editing an image story (\"話\"): get presigned S3 PUT URLs, one per file " +
			"you want to upload. For each returned {key, upload_url}, PUT the raw image bytes to upload_url with a " +
			"Content-Type header matching the content_type you declared for that file (the signature won't validate " +
			"otherwise). Only image/jpeg, image/png, image/webp, and image/gif are accepted; there's a server-side " +
			"cap on how many files you can request per call. After uploading, call storyteller_upsert_image_story " +
			"with the returned keys to actually create or update the story.",
		InputSchema: objectSchema(map[string]interface{}{
			"project_public_id": stringSchema("Project public_id."),
			"content_types": map[string]interface{}{
				"type":        "array",
				"description": "One MIME type per file you intend to upload, in the same order you'll list pages later. Each must be image/jpeg, image/png, image/webp, or image/gif.",
				"items":       map[string]interface{}{"type": "string"},
				"minItems":    1,
			},
		}, []string{"project_public_id", "content_types"}),
		Handler: func(ctx context.Context, arguments map[string]interface{}) (*CallToolResult, error) {
			userID, err := storytellerUserIDFromContext(ctx)
			if err != nil {
				return nil, err
			}
			var args storytellerPresignImageUploadArguments
			if err := decodeArguments(arguments, &args); err != nil {
				return nil, err
			}
			uploads, err := storytellerService.NewService().PresignImageUpload(ctx, userID, args.ProjectPublicID, args.ContentTypes)
			if err != nil {
				return nil, err
			}
			return jsonTextResult(uploads)
		},
	})

	_ = s.RegisterTool(Tool{
		Name:        "storyteller_list_assets",
		Description: "List image assets belonging to a storyteller project. Assets are project-scoped and cannot be used across projects.",
		InputSchema: objectSchema(map[string]interface{}{
			"project_public_id": stringSchema("Project public_id."),
			"collection_id":     stringSchema("Optional asset collection public_id. Omit for all assets, or pass __uncategorized__ for uncategorized assets."),
			"asset_type":        stringSchema("Optional. Currently only image is supported."),
			"keyword":           stringSchema("Optional keyword matched against title, original filename, alt text, or description."),
			"page":              integerSchema("Page number, defaults to 1."),
			"page_size":         integerSchema("Page size, defaults to 24 and maxes at 100."),
		}, []string{"project_public_id"}),
		Handler: func(ctx context.Context, arguments map[string]interface{}) (*CallToolResult, error) {
			userID, err := storytellerUserIDFromContext(ctx)
			if err != nil {
				return nil, err
			}
			var args storytellerListAssetsArguments
			if err := decodeArguments(arguments, &args); err != nil {
				return nil, err
			}
			page, err := storytellerService.NewService().Assets(userID, args.ProjectPublicID, args.CollectionID, args.AssetType, args.Keyword, args.Page, args.PageSize)
			if err != nil {
				return nil, err
			}
			return jsonTextResult(page)
		},
	})

	_ = s.RegisterTool(Tool{
		Name:        "storyteller_get_asset",
		Description: "Get one project asset's metadata and a short-lived preview URL for the authenticated author.",
		InputSchema: objectSchema(map[string]interface{}{
			"project_public_id": stringSchema("Project public_id."),
			"asset_public_id":   stringSchema("Asset public_id."),
		}, []string{"project_public_id", "asset_public_id"}),
		Handler: func(ctx context.Context, arguments map[string]interface{}) (*CallToolResult, error) {
			userID, err := storytellerUserIDFromContext(ctx)
			if err != nil {
				return nil, err
			}
			var args storytellerAssetArguments
			if err := decodeArguments(arguments, &args); err != nil {
				return nil, err
			}
			asset, err := storytellerService.NewService().Asset(userID, args.ProjectPublicID, args.AssetPublicID)
			if err != nil {
				return nil, err
			}
			return jsonTextResult(asset)
		},
	})

	_ = s.RegisterTool(Tool{
		Name: "storyteller_presign_asset_upload",
		Description: "Get presigned S3 PUT URLs for image assets in a project. Upload each file bytes to its upload_url " +
			"with a Content-Type header matching the declared content_type, then call storyteller_confirm_asset_upload.",
		InputSchema: objectSchema(map[string]interface{}{
			"project_public_id": stringSchema("Project public_id."),
			"files": map[string]interface{}{
				"type":        "array",
				"description": "Files to upload. Each item needs content_type (image/jpeg, image/png, image/webp, image/gif) and may include original_filename.",
				"minItems":    1,
				"items": map[string]interface{}{
					"type": "object",
					"properties": map[string]interface{}{
						"content_type":      stringSchema("MIME type. Must be image/jpeg, image/png, image/webp, or image/gif."),
						"original_filename": stringSchema("Original filename for display."),
					},
					"required": []string{"content_type"},
				},
			},
		}, []string{"project_public_id", "files"}),
		Handler: func(ctx context.Context, arguments map[string]interface{}) (*CallToolResult, error) {
			userID, err := storytellerUserIDFromContext(ctx)
			if err != nil {
				return nil, err
			}
			var args storytellerPresignAssetUploadArguments
			if err := decodeArguments(arguments, &args); err != nil {
				return nil, err
			}
			uploads, err := storytellerService.NewService().PresignAssetUpload(ctx, userID, args.ProjectPublicID, storytellerModel.AssetUploadRequest{Files: args.Files})
			if err != nil {
				return nil, err
			}
			return jsonTextResult(uploads)
		},
	})

	_ = s.RegisterTool(Tool{
		Name:        "storyteller_confirm_asset_upload",
		Description: "Confirm a completed presigned asset upload and create the project asset row. Returns asset_public_id and metadata.",
		InputSchema: objectSchema(map[string]interface{}{
			"project_public_id": stringSchema("Project public_id."),
			"key":               stringSchema("S3 key returned by storyteller_presign_asset_upload."),
			"content_type":      stringSchema("MIME type declared during presign."),
			"collection_id":     stringSchema("Optional asset collection public_id. Omit to keep the asset uncategorized."),
			"original_filename": stringSchema("Original filename for display."),
			"title":             stringSchema("Optional asset title."),
			"alt_text":          stringSchema("Optional alt text."),
			"description":       stringSchema("Optional asset description."),
			"metadata":          objectSchema(nil, nil),
		}, []string{"project_public_id", "key", "content_type"}),
		Handler: func(ctx context.Context, arguments map[string]interface{}) (*CallToolResult, error) {
			userID, err := storytellerUserIDFromContext(ctx)
			if err != nil {
				return nil, err
			}
			var args storytellerConfirmAssetUploadArguments
			if err := decodeArguments(arguments, &args); err != nil {
				return nil, err
			}
			asset, err := storytellerService.NewService().ConfirmAssetUpload(userID, args.ProjectPublicID, storytellerModel.AssetConfirmRequest{
				Key:              args.Key,
				ContentType:      args.ContentType,
				CollectionID:     args.CollectionID,
				OriginalFilename: args.OriginalFilename,
				Title:            args.Title,
				AltText:          args.AltText,
				Description:      args.Description,
				Metadata:         args.Metadata,
			})
			if err != nil {
				return nil, err
			}
			return jsonTextResult(asset)
		},
	})

	_ = s.RegisterTool(Tool{
		Name:        "storyteller_update_asset",
		Description: "Update a project asset's title, alt text, description, and metadata.",
		InputSchema: objectSchema(map[string]interface{}{
			"project_public_id": stringSchema("Project public_id."),
			"asset_public_id":   stringSchema("Asset public_id."),
			"title":             stringSchema("Asset title."),
			"alt_text":          stringSchema("Alt text."),
			"description":       stringSchema("Description."),
			"metadata":          objectSchema(nil, nil),
		}, []string{"project_public_id", "asset_public_id"}),
		Handler: func(ctx context.Context, arguments map[string]interface{}) (*CallToolResult, error) {
			userID, err := storytellerUserIDFromContext(ctx)
			if err != nil {
				return nil, err
			}
			var args storytellerUpdateAssetArguments
			if err := decodeArguments(arguments, &args); err != nil {
				return nil, err
			}
			asset, err := storytellerService.NewService().UpdateAsset(userID, args.ProjectPublicID, args.AssetPublicID, storytellerModel.AssetUpdateRequest{
				Title:       args.Title,
				AltText:     args.AltText,
				Description: args.Description,
				Metadata:    args.Metadata,
			})
			if err != nil {
				return nil, err
			}
			return jsonTextResult(asset)
		},
	})

	_ = s.RegisterTool(Tool{
		Name:        "storyteller_move_asset",
		Description: "Move a project asset into an asset collection, or pass an empty collection_id to make it uncategorized.",
		InputSchema: objectSchema(map[string]interface{}{
			"project_public_id": stringSchema("Project public_id."),
			"asset_public_id":   stringSchema("Asset public_id."),
			"collection_id":     stringSchema("Target asset collection public_id. Empty string moves the asset back to uncategorized."),
		}, []string{"project_public_id", "asset_public_id"}),
		Handler: func(ctx context.Context, arguments map[string]interface{}) (*CallToolResult, error) {
			userID, err := storytellerUserIDFromContext(ctx)
			if err != nil {
				return nil, err
			}
			var args storytellerMoveAssetArguments
			if err := decodeArguments(arguments, &args); err != nil {
				return nil, err
			}
			asset, err := storytellerService.NewService().MoveAsset(userID, args.ProjectPublicID, args.AssetPublicID, storytellerModel.AssetMoveRequest{CollectionID: args.CollectionID})
			if err != nil {
				return nil, err
			}
			return jsonTextResult(asset)
		},
	})

	_ = s.RegisterTool(Tool{
		Name:        "storyteller_list_asset_collections",
		Description: "List asset collections belonging to a storyteller project, including asset counts.",
		InputSchema: objectSchema(map[string]interface{}{
			"project_public_id": stringSchema("Project public_id."),
		}, []string{"project_public_id"}),
		Handler: func(ctx context.Context, arguments map[string]interface{}) (*CallToolResult, error) {
			userID, err := storytellerUserIDFromContext(ctx)
			if err != nil {
				return nil, err
			}
			var args storytellerAssetCollectionArguments
			if err := decodeArguments(arguments, &args); err != nil {
				return nil, err
			}
			collections, err := storytellerService.NewService().AssetCollections(userID, args.ProjectPublicID)
			if err != nil {
				return nil, err
			}
			return jsonTextResult(collections)
		},
	})

	_ = s.RegisterTool(Tool{
		Name:        "storyteller_create_asset_collection",
		Description: "Create an asset collection inside a storyteller project.",
		InputSchema: objectSchema(map[string]interface{}{
			"project_public_id": stringSchema("Project public_id."),
			"name":              stringSchema("Collection name."),
			"description":       stringSchema("Optional note describing what this asset collection is for."),
			"sort":              integerSchema("Display order among asset collections."),
		}, []string{"project_public_id", "name"}),
		Handler: func(ctx context.Context, arguments map[string]interface{}) (*CallToolResult, error) {
			userID, err := storytellerUserIDFromContext(ctx)
			if err != nil {
				return nil, err
			}
			var args storytellerUpsertAssetCollectionArguments
			if err := decodeArguments(arguments, &args); err != nil {
				return nil, err
			}
			collection, err := storytellerService.NewService().CreateAssetCollection(userID, args.ProjectPublicID, storytellerModel.AssetCollectionRequest{Name: args.Name, Description: args.Description, Sort: args.Sort})
			if err != nil {
				return nil, err
			}
			return jsonTextResult(collection)
		},
	})

	_ = s.RegisterTool(Tool{
		Name:        "storyteller_update_asset_collection",
		Description: "Rename an asset collection or update its display order.",
		InputSchema: objectSchema(map[string]interface{}{
			"project_public_id":    stringSchema("Project public_id."),
			"collection_public_id": stringSchema("Asset collection public_id."),
			"name":                 stringSchema("Collection name."),
			"description":          stringSchema("Optional note describing what this asset collection is for."),
			"sort":                 integerSchema("Display order among asset collections."),
		}, []string{"project_public_id", "collection_public_id", "name"}),
		Handler: func(ctx context.Context, arguments map[string]interface{}) (*CallToolResult, error) {
			userID, err := storytellerUserIDFromContext(ctx)
			if err != nil {
				return nil, err
			}
			var args storytellerUpsertAssetCollectionArguments
			if err := decodeArguments(arguments, &args); err != nil {
				return nil, err
			}
			collection, err := storytellerService.NewService().UpdateAssetCollection(userID, args.ProjectPublicID, args.CollectionPublicID, storytellerModel.AssetCollectionRequest{Name: args.Name, Description: args.Description, Sort: args.Sort})
			if err != nil {
				return nil, err
			}
			return jsonTextResult(collection)
		},
	})

	_ = s.RegisterTool(Tool{
		Name:        "storyteller_delete_asset_collection",
		Description: "Soft-delete an empty asset collection. Fails while the collection still contains assets.",
		InputSchema: objectSchema(map[string]interface{}{
			"project_public_id":    stringSchema("Project public_id."),
			"collection_public_id": stringSchema("Asset collection public_id."),
		}, []string{"project_public_id", "collection_public_id"}),
		Handler: func(ctx context.Context, arguments map[string]interface{}) (*CallToolResult, error) {
			userID, err := storytellerUserIDFromContext(ctx)
			if err != nil {
				return nil, err
			}
			var args storytellerAssetCollectionArguments
			if err := decodeArguments(arguments, &args); err != nil {
				return nil, err
			}
			if err := storytellerService.NewService().DeleteAssetCollection(userID, args.ProjectPublicID, args.CollectionPublicID); err != nil {
				return nil, err
			}
			return textResult("deleted"), nil
		},
	})

	_ = s.RegisterTool(Tool{
		Name:        "storyteller_delete_asset",
		Description: "Soft-delete a project asset. Fails if the asset is still referenced by latest content.",
		InputSchema: objectSchema(map[string]interface{}{
			"project_public_id": stringSchema("Project public_id."),
			"asset_public_id":   stringSchema("Asset public_id."),
		}, []string{"project_public_id", "asset_public_id"}),
		Handler: func(ctx context.Context, arguments map[string]interface{}) (*CallToolResult, error) {
			userID, err := storytellerUserIDFromContext(ctx)
			if err != nil {
				return nil, err
			}
			var args storytellerAssetArguments
			if err := decodeArguments(arguments, &args); err != nil {
				return nil, err
			}
			if err := storytellerService.NewService().DeleteAsset(userID, args.ProjectPublicID, args.AssetPublicID); err != nil {
				return nil, err
			}
			return textResult("deleted"), nil
		},
	})

	_ = s.RegisterTool(Tool{
		Name: "storyteller_upsert_image_story",
		Description: "Step 2: create or update an image story (\"話\") using keys obtained from " +
			"storyteller_presign_image_upload (after you've actually PUT the file bytes to their upload_url). " +
			"Omit story_public_id to create a new one; pass an existing story_public_id to overwrite its pages " +
			"(this creates a new version, the previous content is not lost). Pages are ordered by their position " +
			"in the pages array — list them in the order they should appear. When updating an existing story, " +
			"re-fetch it with storyteller_get_story first and pass back the id/key of any existing pages you want " +
			"to keep (in your desired order, mixed in with any new pages); omitting an existing page removes it " +
			"from the story. content_type is fixed to image and cannot be changed once created.",
		InputSchema: objectSchema(map[string]interface{}{
			"project_public_id": stringSchema("Project public_id."),
			"story_public_id":   stringSchema("Existing story public_id to update. Omit to create a new image story."),
			"title":             stringSchema("Story title, required."),
			"summary":           stringSchema("Short summary shown in listings."),
			"status":            stringSchema("draft or completed, defaults to completed."),
			"sort":              integerSchema("Display order among the project's stories."),
			"pages": map[string]interface{}{
				"type":        "array",
				"description": "The pages in display order. Each needs a key from storyteller_presign_image_upload (for existing pages being kept, reuse the key/id storyteller_get_story returned).",
				"minItems":    1,
				"items": map[string]interface{}{
					"type": "object",
					"properties": map[string]interface{}{
						"id":          stringSchema("Omit for new pages (the server generates one). For an existing page you're keeping, pass back the id storyteller_get_story returned so bookmarks etc. stay attached to it."),
						"key":         stringSchema("The S3 key for this page: from storyteller_presign_image_upload for a new page, or the existing page's key (from storyteller_get_story) if you're keeping it unchanged."),
						"description": stringSchema("Optional per-page caption/description text."),
					},
					"required": []string{"key"},
				},
			},
			"base_version_id": integerSchema("Optional. The version_id you last read via storyteller_get_story; the response's version_conflict flags if the story has moved on since, but the write still always happens."),
		}, []string{"project_public_id", "title", "pages"}),
		Handler: func(ctx context.Context, arguments map[string]interface{}) (*CallToolResult, error) {
			userID, err := storytellerUserIDFromContext(ctx)
			if err != nil {
				return nil, err
			}
			var args storytellerUpsertImageStoryArguments
			if err := decodeArguments(arguments, &args); err != nil {
				return nil, err
			}
			if len(args.Pages) == 0 {
				return nil, errors.New("pages must not be empty")
			}
			pages := make([]storytellerModel.StoryImagePage, 0, len(args.Pages))
			for i, page := range args.Pages {
				key := strings.TrimSpace(page.Key)
				if key == "" {
					return nil, fmt.Errorf("pages[%d].key is required", i)
				}
				id := strings.TrimSpace(page.ID)
				if id == "" {
					id = storytellerRandomPageID()
				}
				pages = append(pages, storytellerModel.StoryImagePage{
					ID:          id,
					Key:         key,
					Description: page.Description,
					Sort:        i,
				})
			}
			content, err := json.Marshal(storytellerModel.StoryImageContent{Pages: pages})
			if err != nil {
				return nil, err
			}
			input := storytellerModel.StoryRequest{
				Title:         args.Title,
				Summary:       args.Summary,
				Status:        storytellerModel.StoryStatus(args.Status),
				Sort:          args.Sort,
				Content:       string(content),
				BaseVersionID: args.BaseVersionID,
				ContentType:   storytellerModel.ProjectContentTypeImage,
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
			pagesOutput, err := service.ImageStoryPages(userID, args.ProjectPublicID, story.PublicID)
			if err != nil {
				return nil, err
			}
			return jsonTextResult(storytellerStoryDetail{
				storytellerStorySummary: toStorytellerStorySummary(*story),
				Pages:                   pagesOutput,
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

// storytellerRandomPageID 給沒帶 id 的新圖片頁面生一個 id，比照
// service/storyteller/storyteller.go 的 randomID() 做法（那邊是 unexported，
// 不同 package 呼叫不到，這裡另外生一份一樣邏輯的小函式，不值得為此互相 export）。
func storytellerRandomPageID() string {
	buf := make([]byte, 8)
	if _, err := rand.Read(buf); err != nil {
		return ""
	}
	return hex.EncodeToString(buf)
}
