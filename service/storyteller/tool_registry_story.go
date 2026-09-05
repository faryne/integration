package storyteller

import (
	"context"
	"crypto/rand"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"regexp"
	"strings"
	"time"

	storytellerModel "faryne.dev/model/entity/storyteller"
)

type storytellerStoryArguments struct {
	ProjectPublicID string `json:"project_public_id"`
	StoryPublicID   string `json:"story_public_id"`
}

type storytellerListPageArguments struct {
	ProjectPublicID string `json:"project_public_id"`
	CollectionID    string `json:"collection_id"`
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
	VolumePublicID  *string `json:"volume_public_id"`
	BaseVersionID   *uint64 `json:"base_version_id"`
}

type storytellerPatchStoryArguments struct {
	ProjectPublicID string  `json:"project_public_id"`
	StoryPublicID   string  `json:"story_public_id"`
	Title           *string `json:"title"`
	Summary         *string `json:"summary"`
	Status          *string `json:"status"`
	Sort            *int    `json:"sort"`
	Content         *string `json:"content"`
	ParentID        *string `json:"parent_id"`
	BaseVersionID   *uint64 `json:"base_version_id"`
}

func (a storytellerPatchStoryArguments) hasContentField() bool {
	return a.Title != nil || a.Summary != nil || a.Status != nil || a.Sort != nil || a.Content != nil
}

type storytellerSearchReplaceStoryArguments struct {
	ProjectPublicID string `json:"project_public_id"`
	StoryPublicID   string `json:"story_public_id"`
	Search          string `json:"search"`
	Replace         string `json:"replace"`
	IsRegex         bool   `json:"is_regex"`
}

type storytellerStoryVersionArguments struct {
	ProjectPublicID string `json:"project_public_id"`
	StoryPublicID   string `json:"story_public_id"`
	TargetVersionID uint64 `json:"target_version_id"`
}

type storytellerGetStoryVersionArguments struct {
	ProjectPublicID string `json:"project_public_id"`
	StoryPublicID   string `json:"story_public_id"`
	VersionID       uint64 `json:"version_id"`
}

// storytellerStoryVersionSummary 是版本列表專用輸出，刻意不含 Content，避免歷史一多就塞爆 MCP 回應。
type storytellerStoryVersionSummary struct {
	ID                      uint64    `json:"id"`
	Title                   string    `json:"title"`
	Summary                 string    `json:"summary"`
	WordCount               uint      `json:"word_count"`
	RevertedFromVersionID   *uint64   `json:"reverted_from_version_id"`
	ConflictedWithVersionID *uint64   `json:"conflicted_with_version_id"`
	CreatedAt               time.Time `json:"created_at"`
}

type storytellerMoveStoryArguments struct {
	ProjectPublicID string `json:"project_public_id"`
	StoryPublicID   string `json:"story_public_id"`
	VolumePublicID  string `json:"volume_public_id"`
}

type storytellerPresignImageUploadArguments struct {
	ProjectPublicID string   `json:"project_public_id"`
	ContentTypes    []string `json:"content_types"`
}

// storytellerImagePageArguments 是 storyteller_upsert_image_story 的單一頁面：Key 一定要是
// storyteller_presign_image_upload 給的 key，且該 key 對應的檔案要先實際 PUT 上傳完成，
// 不然存檔時的檔案大小檢查（HeadObject）會找不到物件而失敗。ID 留空代表新頁面，伺服器
// 會生一個；更新既有話時，既有頁面要把 storyteller_get_story 回傳的 id/key 原樣帶回來，
// 不然這頁會被當成全新頁面（書籤等關聯資料會跟舊的 id 對不上）。頁面順序＝陣列順序，
// 不需要（也不支援）另外帶 sort。
type storytellerImagePageArguments struct {
	ID            string `json:"id"`
	Key           string `json:"key"`
	AssetPublicID string `json:"asset_public_id"`
	Description   string `json:"description"`
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

type storytellerSearchReplaceOutput struct {
	MatchCount                 int `json:"match_count"`
	TextMatchCount             int `json:"text_match_count"`
	ImageDescriptionMatchCount int `json:"image_description_match_count"`
	AffectedPages              int `json:"affected_pages"`
}

type storytellerStorySearchReplaceOutput struct {
	storytellerStoryDetail
	storytellerSearchReplaceOutput
}

type storytellerReplaceResult struct {
	Content                    string
	MatchCount                 int
	TextMatchCount             int
	ImageDescriptionMatchCount int
	AffectedPages              int
}

func storytellerStoryToolSpecs() []ToolSpec {
	return []ToolSpec{
		ToolSpec{
			Name: "storyteller_list_stories",
			Description: "Paginate a project's stories (titles/summaries only, use storyteller_get_story for full content). " +
				"Use this when a project has more stories than storyteller_get_project's embedded list shows (see its story_count).",
			InputSchema: objectSchema(map[string]interface{}{
				"project_public_id": stringSchema("Project public_id."),
				"page":              integerSchema("Page number, starting at 1. Defaults to 1."),
				"page_size":         integerSchema("Items per page, defaults to 20, capped at 100."),
			}, []string{"project_public_id"}),
			Handler: func(ctx context.Context, arguments map[string]interface{}) (interface{}, error) {
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
				stories, total, err := NewService().StoriesPage(userID, args.ProjectPublicID, page, pageSize)
				if err != nil {
					return nil, err
				}
				summaries := make([]storytellerStorySummary, 0, len(stories))
				for _, story := range stories {
					summaries = append(summaries, toStorytellerStorySummary(story))
				}
				return storytellerStoryListOutput{
					Stories:    summaries,
					TotalCount: total,
					Page:       page,
					PageSize:   pageSize,
				}, nil
			},
		},

		ToolSpec{
			Name: "storyteller_get_story",
			Description: "Get a story's full content by project_public_id and story_public_id. " +
				"For content_type=text stories, content holds the story text. For content_type=image stories " +
				"(a \"話\"), content is empty and pages holds each page's id/key/description/sort plus a signed " +
				"image_url you can fetch directly; to create or edit an image story use storyteller_presign_image_upload " +
				"and storyteller_upsert_image_story instead of storyteller_upsert_story. " +
				"The returned version_id should be kept and passed back as base_version_id on storyteller_upsert_story " +
				"(or storyteller_upsert_image_story) to detect if someone else (e.g. the web editor) changed the story " +
				"in the meantime. " + storytellerContentMarkerHint,
			InputSchema: objectSchema(map[string]interface{}{
				"project_public_id": stringSchema("Project public_id."),
				"story_public_id":   stringSchema("Story public_id, as returned by storyteller_get_project."),
			}, []string{"project_public_id", "story_public_id"}),
			Handler: func(ctx context.Context, arguments map[string]interface{}) (interface{}, error) {
				userID, err := storytellerUserIDFromContext(ctx)
				if err != nil {
					return nil, err
				}
				var args storytellerStoryArguments
				if err := decodeArguments(arguments, &args); err != nil {
					return nil, err
				}
				service := NewService()
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
				return detail, nil
			},
		},

		ToolSpec{
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
				"story_public_id": stringSchema("Existing story public_id to update. Omit ONLY when you actually want to create a brand " +
					"new, separate story — omitting it while intending to update an existing one (e.g. \"@thisStory\" or a story " +
					"you just read via storyteller_get_story/storyteller_list_stories) silently creates a duplicate instead of " +
					"updating it. If you have a story_public_id in hand for the item you mean, always pass it back here."),
				"title":   stringSchema("Story title, required."),
				"summary": stringSchema("Short summary shown in listings."),
				"status":  stringSchema("draft or completed, defaults to completed."),
				"sort":    integerSchema("Display order among the project's stories."),
				"content": stringSchema(
					"Full story content, required. Writing the content into your chat reply instead of this argument does " +
						"NOT count — the proposal card shown to the user is built purely from this argument, so if you leave " +
						"it out the user sees an empty diff and an empty overwrite. " + storytellerContentSyntaxHint + " " + storytellerContentMarkerHint,
				),
				"volume_public_id": stringSchema("Optional, but semantically important. Omit to preserve the story's current volume membership on update; pass an empty string to remove it from any volume; pass a volume public_id to move it into that volume."),
				"base_version_id":  integerSchema("Optional. The version_id you last read via storyteller_get_story; the response's version_conflict flags if the story has moved on since, but the write still always happens."),
			}, []string{"project_public_id", "title", "content"}),
			Handler: func(ctx context.Context, arguments map[string]interface{}) (interface{}, error) {
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
					ParentID:      args.VolumePublicID,
				}
				source := storytellerSourceFromContext(ctx)
				service := NewService()
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
				return storytellerStoryDetail{
					storytellerStorySummary: toStorytellerStorySummary(*story),
					Content:                 story.LatestContent,
					VersionID:               derefUint64(story.LatestVersionID),
					VersionConflict:         conflicted,
				}, nil
			},
		},

		ToolSpec{
			Name: "storyteller_list_story_versions",
			Description: "List a story's version history by project_public_id and story_public_id. " +
				"This returns summary metadata only and does not include full content; use storyteller_get_story_version " +
				"to read one version's full content, or storyteller_revert_story to restore a version.",
			InputSchema: objectSchema(map[string]interface{}{
				"project_public_id": stringSchema("Project public_id."),
				"story_public_id":   stringSchema("Story public_id."),
			}, []string{"project_public_id", "story_public_id"}),
			Handler: func(ctx context.Context, arguments map[string]interface{}) (interface{}, error) {
				userID, err := storytellerUserIDFromContext(ctx)
				if err != nil {
					return nil, err
				}
				var args storytellerStoryArguments
				if err := decodeArguments(arguments, &args); err != nil {
					return nil, err
				}
				versions, err := NewService().StoryVersions(userID, args.ProjectPublicID, args.StoryPublicID)
				if err != nil {
					return nil, err
				}
				summaries := make([]storytellerStoryVersionSummary, 0, len(versions))
				for _, version := range versions {
					summaries = append(summaries, storytellerStoryVersionSummary{
						ID:                      version.ID,
						Title:                   version.Title,
						Summary:                 version.Summary,
						WordCount:               version.WordCount,
						RevertedFromVersionID:   version.RevertedFromVersionID,
						ConflictedWithVersionID: version.ConflictedWithVersionID,
						CreatedAt:               version.CreatedAt,
					})
				}
				return summaries, nil
			},
		},

		ToolSpec{
			Name: "storyteller_get_story_version",
			Description: "Get one story version's full content by project_public_id, story_public_id, and version_id. " +
				"Use storyteller_list_story_versions to find candidate version ids first; use storyteller_revert_story " +
				"if you decide to restore one of them.",
			InputSchema: objectSchema(map[string]interface{}{
				"project_public_id": stringSchema("Project public_id."),
				"story_public_id":   stringSchema("Story public_id."),
				"version_id":        integerSchema("Version id to read."),
			}, []string{"project_public_id", "story_public_id", "version_id"}),
			Handler: func(ctx context.Context, arguments map[string]interface{}) (interface{}, error) {
				userID, err := storytellerUserIDFromContext(ctx)
				if err != nil {
					return nil, err
				}
				var args storytellerGetStoryVersionArguments
				if err := decodeArguments(arguments, &args); err != nil {
					return nil, err
				}
				return NewService().StoryVersion(userID, args.ProjectPublicID, args.StoryPublicID, args.VersionID)
			},
		},

		ToolSpec{
			Name: "storyteller_revert_story",
			Description: "Revert a story to a previous version by creating a new latest version from target_version_id. " +
				"target_version_id can come from storyteller_list_story_versions, or from storyteller_get_story when restoring " +
				"the current latest version id after checking the latest content.",
			InputSchema: objectSchema(map[string]interface{}{
				"project_public_id": stringSchema("Project public_id."),
				"story_public_id":   stringSchema("Story public_id."),
				"target_version_id": integerSchema("Version id to restore from."),
			}, []string{"project_public_id", "story_public_id", "target_version_id"}),
			Handler: func(ctx context.Context, arguments map[string]interface{}) (interface{}, error) {
				userID, err := storytellerUserIDFromContext(ctx)
				if err != nil {
					return nil, err
				}
				var args storytellerStoryVersionArguments
				if err := decodeArguments(arguments, &args); err != nil {
					return nil, err
				}
				story, err := NewService().RevertStory(userID, args.ProjectPublicID, args.StoryPublicID, args.TargetVersionID, "mcp")
				if err != nil {
					return nil, err
				}
				return storytellerStoryDetail{
					storytellerStorySummary: toStorytellerStorySummary(*story),
					Content:                 story.LatestContent,
					VersionID:               derefUint64(story.LatestVersionID),
				}, nil
			},
		},

		ToolSpec{
			Name: "storyteller_patch_story",
			Description: "Patch selected fields on an existing story. Omit a field to leave it unchanged. " +
				"This is deliberately different from storyteller_upsert_story: upsert has full-overwrite semantics, " +
				"so omitting title/summary/status/sort/content there overwrites them with empty or zero values. " +
				"Use this tool when you only want to change specific fields. At least one of title, summary, status, sort, or content must be provided. " +
				"parent_id is optional and only changes volume membership when present; empty string removes the story from any volume.",
			InputSchema: objectSchema(map[string]interface{}{
				"project_public_id": stringSchema("Project public_id."),
				"story_public_id":   stringSchema("Existing story public_id to patch."),
				"title":             stringSchema("Optional. New story title. Omit to keep the current title."),
				"summary":           stringSchema("Optional. New listing summary. Omit to keep the current summary."),
				"status":            stringSchema("Optional. draft or completed. Omit to keep the current status."),
				"sort":              integerSchema("Optional. New display order. Omit to keep the current sort."),
				"content":           stringSchema("Optional. New full content. Omit to keep the current content. " + storytellerContentSyntaxHint + " " + storytellerContentMarkerHint),
				"parent_id":         stringSchema("Optional. Omit to keep current volume membership; pass empty string to remove it from any volume; pass a volume public_id to move it into that volume."),
				"base_version_id":   integerSchema("Optional. The version_id you last read via storyteller_get_story; version_conflict flags if the story has moved on since, but the write still happens."),
			}, []string{"project_public_id", "story_public_id"}),
			Handler: func(ctx context.Context, arguments map[string]interface{}) (interface{}, error) {
				userID, err := storytellerUserIDFromContext(ctx)
				if err != nil {
					return nil, err
				}
				var args storytellerPatchStoryArguments
				if err := decodeArguments(arguments, &args); err != nil {
					return nil, err
				}
				if !args.hasContentField() {
					return nil, errors.New("at least one field to update must be specified")
				}
				service := NewService()
				current, err := service.Story(userID, args.ProjectPublicID, args.StoryPublicID)
				if err != nil {
					return nil, err
				}
				input := mergeStoryPatch(current, args)
				story, conflicted, err := service.UpdateStory(userID, args.ProjectPublicID, args.StoryPublicID, input, storytellerSourceFromContext(ctx))
				if err != nil {
					return nil, err
				}
				return storytellerStoryDetailForOutput(service, userID, args.ProjectPublicID, story, conflicted)
			},
		},

		ToolSpec{
			Name: "storyteller_search_replace_story",
			Description: "Search and replace inside one existing story, writing directly with no dry run. " +
				"For content_type=text stories this targets content. For content_type=image stories this targets only each page's description field, " +
				"then rebuilds the pages JSON so JSON structure is never searched or modified as raw text. " +
				"Search is case-sensitive. When is_regex is false, search is treated as a literal string via regexp.QuoteMeta; when true, search uses Go RE2 regexp syntax and replace may use $1/${name} capture references. " +
				"If match_count is 0, nothing is written and no new version is created; otherwise this saves through the same versioned path as storyteller_upsert_story.",
			InputSchema: objectSchema(map[string]interface{}{
				"project_public_id": stringSchema("Project public_id."),
				"story_public_id":   stringSchema("Existing story public_id to edit."),
				"search":            stringSchema("Required search text or RE2 regexp pattern. Case-sensitive unless is_regex=true and you include an inline flag such as (?i)."),
				"replace":           stringSchema("Required replacement text. When is_regex=true, Go regexp replacement references such as $1 and ${name} are supported."),
				"is_regex":          booleanSchema("Optional, defaults to false. false means literal search; true means compile search as a Go RE2 regexp."),
			}, []string{"project_public_id", "story_public_id", "search", "replace"}),
			Handler: func(ctx context.Context, arguments map[string]interface{}) (interface{}, error) {
				userID, err := storytellerUserIDFromContext(ctx)
				if err != nil {
					return nil, err
				}
				var args storytellerSearchReplaceStoryArguments
				if err := decodeArguments(arguments, &args); err != nil {
					return nil, err
				}
				pattern, err := compileStorytellerSearchPattern(args.Search, args.IsRegex)
				if err != nil {
					return nil, err
				}
				service := NewService()
				current, err := service.Story(userID, args.ProjectPublicID, args.StoryPublicID)
				if err != nil {
					return nil, err
				}
				replaceResult, err := replaceStoryContent(current.ContentType, current.LatestContent, pattern, args.Replace)
				if err != nil {
					return nil, err
				}
				if replaceResult.MatchCount == 0 {
					detail, err := storytellerStoryDetailForOutput(service, userID, args.ProjectPublicID, current, false)
					if err != nil {
						return nil, err
					}
					return storytellerStorySearchReplaceOutput{storytellerStoryDetail: detail, storytellerSearchReplaceOutput: replaceResult.output()}, nil
				}
				input := storytellerModel.StoryRequest{
					Title:         current.Title,
					Summary:       current.Summary,
					Status:        current.Status,
					Sort:          current.Sort,
					Content:       replaceResult.Content,
					ContentType:   current.ContentType,
					BaseVersionID: current.LatestVersionID,
				}
				story, conflicted, err := service.UpdateStory(userID, args.ProjectPublicID, args.StoryPublicID, input, storytellerSourceFromContext(ctx))
				if err != nil {
					return nil, err
				}
				detail, err := storytellerStoryDetailForOutput(service, userID, args.ProjectPublicID, story, conflicted)
				if err != nil {
					return nil, err
				}
				return storytellerStorySearchReplaceOutput{storytellerStoryDetail: detail, storytellerSearchReplaceOutput: replaceResult.output()}, nil
			},
		},

		ToolSpec{
			Name:        "storyteller_move_story",
			Description: "Move a story into a volume, or pass an empty volume_public_id to move it out of any volume.",
			InputSchema: objectSchema(map[string]interface{}{
				"project_public_id": stringSchema("Project public_id."),
				"story_public_id":   stringSchema("Story public_id."),
				"volume_public_id":  stringSchema("Target volume public_id. Empty string moves the story out of any volume."),
			}, []string{"project_public_id", "story_public_id"}),
			Handler: func(ctx context.Context, arguments map[string]interface{}) (interface{}, error) {
				userID, err := storytellerUserIDFromContext(ctx)
				if err != nil {
					return nil, err
				}
				var args storytellerMoveStoryArguments
				if err := decodeArguments(arguments, &args); err != nil {
					return nil, err
				}
				story, err := NewService().MoveStory(userID, args.ProjectPublicID, args.StoryPublicID, storytellerModel.StoryMoveRequest{VolumePublicID: args.VolumePublicID})
				if err != nil {
					return nil, err
				}
				return toStorytellerStorySummary(*story), nil
			},
		},

		ToolSpec{
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
			Handler: func(ctx context.Context, arguments map[string]interface{}) (interface{}, error) {
				userID, err := storytellerUserIDFromContext(ctx)
				if err != nil {
					return nil, err
				}
				var args storytellerPresignImageUploadArguments
				if err := decodeArguments(arguments, &args); err != nil {
					return nil, err
				}
				uploads, err := NewService().PresignImageUpload(ctx, userID, args.ProjectPublicID, args.ContentTypes)
				if err != nil {
					return nil, err
				}
				return uploads, nil
			},
		},

		ToolSpec{
			Name: "storyteller_upsert_image_story",
			Description: "Step 2: create or update an image story (\"話\") using asset_public_id values from " +
				"storyteller_confirm_asset_upload, or legacy keys obtained from storyteller_presign_image_upload. " +
				"Omit story_public_id to create a new one; pass an existing story_public_id to overwrite its pages " +
				"(this creates a new version, the previous content is not lost). Pages are ordered by their position " +
				"in the pages array — list them in the order they should appear. When updating an existing story, " +
				"re-fetch it with storyteller_get_story first and pass back the id plus asset_public_id or key of any existing pages you want " +
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
					"description": "The pages in display order. Each needs either asset_public_id from asset upload/lookup or a legacy key from storyteller_presign_image_upload.",
					"minItems":    1,
					"items": map[string]interface{}{
						"type": "object",
						"properties": map[string]interface{}{
							"id":              stringSchema("Omit for new pages (the server generates one). For an existing page you're keeping, pass back the id storyteller_get_story returned so bookmarks etc. stay attached to it."),
							"key":             stringSchema("Legacy S3 key for this page: from storyteller_presign_image_upload for a new page, or the existing page's key if keeping it unchanged."),
							"asset_public_id": stringSchema("Preferred. Asset public_id belonging to the same project."),
							"description":     stringSchema("Optional per-page caption/description text."),
						},
					},
				},
				"base_version_id": integerSchema("Optional. The version_id you last read via storyteller_get_story; the response's version_conflict flags if the story has moved on since, but the write still always happens."),
			}, []string{"project_public_id", "title", "pages"}),
			Handler: func(ctx context.Context, arguments map[string]interface{}) (interface{}, error) {
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
					assetPublicID := strings.TrimSpace(page.AssetPublicID)
					if key == "" && assetPublicID == "" {
						return nil, fmt.Errorf("pages[%d] needs key or asset_public_id", i)
					}
					id := strings.TrimSpace(page.ID)
					if id == "" {
						id = storytellerRandomPageID()
					}
					pages = append(pages, storytellerModel.StoryImagePage{
						ID:            id,
						Key:           key,
						AssetPublicID: assetPublicID,
						Description:   page.Description,
						Sort:          i,
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
				service := NewService()
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
				return storytellerStoryDetail{
					storytellerStorySummary: toStorytellerStorySummary(*story),
					Pages:                   pagesOutput,
					VersionID:               derefUint64(story.LatestVersionID),
					VersionConflict:         conflicted,
				}, nil
			},
		},

		ToolSpec{
			Name:        "storyteller_delete_story",
			Description: "Delete a story by project_public_id and story_public_id.",
			InputSchema: objectSchema(map[string]interface{}{
				"project_public_id": stringSchema("Project public_id."),
				"story_public_id":   stringSchema("Story public_id."),
			}, []string{"project_public_id", "story_public_id"}),
			Handler: func(ctx context.Context, arguments map[string]interface{}) (interface{}, error) {
				userID, err := storytellerUserIDFromContext(ctx)
				if err != nil {
					return nil, err
				}
				var args storytellerStoryArguments
				if err := decodeArguments(arguments, &args); err != nil {
					return nil, err
				}
				if err := NewService().DeleteStory(userID, args.ProjectPublicID, args.StoryPublicID); err != nil {
					return nil, err
				}
				return "deleted", nil
			},
		},
	}
}

func storytellerRandomPageID() string {
	buf := make([]byte, 8)
	if _, err := rand.Read(buf); err != nil {
		return ""
	}
	return hex.EncodeToString(buf)
}

func mergeStoryPatch(story *storytellerModel.Story, args storytellerPatchStoryArguments) storytellerModel.StoryRequest {
	input := storytellerModel.StoryRequest{
		Title:         story.Title,
		Summary:       story.Summary,
		Status:        story.Status,
		Sort:          story.Sort,
		Content:       story.LatestContent,
		ParentID:      args.ParentID,
		BaseVersionID: args.BaseVersionID,
		ContentType:   story.ContentType,
	}
	if args.Title != nil {
		input.Title = *args.Title
	}
	if args.Summary != nil {
		input.Summary = *args.Summary
	}
	if args.Status != nil {
		input.Status = storytellerModel.StoryStatus(*args.Status)
	}
	if args.Sort != nil {
		input.Sort = *args.Sort
	}
	if args.Content != nil {
		input.Content = *args.Content
	}
	return input
}

func compileStorytellerSearchPattern(search string, isRegex bool) (*regexp.Regexp, error) {
	pattern := search
	if !isRegex {
		pattern = regexp.QuoteMeta(search)
	}
	re, err := regexp.Compile(pattern)
	if err != nil {
		return nil, fmt.Errorf("invalid search pattern: %w", err)
	}
	return re, nil
}

func replaceStoryContent(contentType storytellerModel.ProjectContentType, rawContent string, pattern *regexp.Regexp, replace string) (storytellerReplaceResult, error) {
	if contentType == storytellerModel.ProjectContentTypeImage {
		return replaceImageStoryDescriptions(rawContent, pattern, replace)
	}
	content, count := replaceAllCounting(pattern, rawContent, replace)
	return storytellerReplaceResult{
		Content:        content,
		MatchCount:     count,
		TextMatchCount: count,
	}, nil
}

func replaceImageStoryDescriptions(rawContent string, pattern *regexp.Regexp, replace string) (storytellerReplaceResult, error) {
	var content storytellerModel.StoryImageContent
	if err := json.Unmarshal([]byte(rawContent), &content); err != nil {
		return storytellerReplaceResult{}, fmt.Errorf("invalid image story content: %w", err)
	}
	result := storytellerReplaceResult{}
	for i := range content.Pages {
		description, count := replaceAllCounting(pattern, content.Pages[i].Description, replace)
		if count == 0 {
			continue
		}
		content.Pages[i].Description = description
		result.MatchCount += count
		result.ImageDescriptionMatchCount += count
		result.AffectedPages++
	}
	if result.MatchCount == 0 {
		result.Content = rawContent
		return result, nil
	}
	body, err := json.Marshal(content)
	if err != nil {
		return storytellerReplaceResult{}, err
	}
	result.Content = string(body)
	return result, nil
}

func replaceAllCounting(pattern *regexp.Regexp, input, replace string) (string, int) {
	matches := pattern.FindAllStringIndex(input, -1)
	if len(matches) == 0 {
		return input, 0
	}
	return pattern.ReplaceAllString(input, replace), len(matches)
}

func (r storytellerReplaceResult) output() storytellerSearchReplaceOutput {
	return storytellerSearchReplaceOutput{
		MatchCount:                 r.MatchCount,
		TextMatchCount:             r.TextMatchCount,
		ImageDescriptionMatchCount: r.ImageDescriptionMatchCount,
		AffectedPages:              r.AffectedPages,
	}
}

func storytellerStoryDetailForOutput(service *Service, userID uint64, projectPublicID string, story *storytellerModel.Story, conflicted bool) (storytellerStoryDetail, error) {
	detail := storytellerStoryDetail{
		storytellerStorySummary: toStorytellerStorySummary(*story),
		VersionID:               derefUint64(story.LatestVersionID),
		VersionConflict:         conflicted,
	}
	if story.ContentType == storytellerModel.ProjectContentTypeImage {
		pages, err := service.ImageStoryPages(userID, projectPublicID, story.PublicID)
		if err != nil {
			return storytellerStoryDetail{}, err
		}
		detail.Pages = pages
	} else {
		detail.Content = story.LatestContent
	}
	return detail, nil
}
