package storyteller

import (
	"context"
	"errors"
	"time"

	storytellerModel "faryne.dev/model/entity/storyteller"
)

type storytellerLoreArguments struct {
	ProjectPublicID string `json:"project_public_id"`
	LorePublicID    string `json:"lore_public_id"`
}

type storytellerUpsertLoreArguments struct {
	ProjectPublicID string  `json:"project_public_id"`
	LorePublicID    string  `json:"lore_public_id"`
	Title           string  `json:"title"`
	CollectionID    *string `json:"collection_id"`
	Content         string  `json:"content"`
	BaseVersionID   *uint64 `json:"base_version_id"`
}

type storytellerPatchLoreArguments struct {
	ProjectPublicID string  `json:"project_public_id"`
	LorePublicID    string  `json:"lore_public_id"`
	Title           *string `json:"title"`
	Content         *string `json:"content"`
	CollectionID    *string `json:"collection_id"`
	BaseVersionID   *uint64 `json:"base_version_id"`
}

func (a storytellerPatchLoreArguments) hasContentField() bool {
	return a.Title != nil || a.Content != nil
}

type storytellerSearchReplaceLoreArguments struct {
	ProjectPublicID string `json:"project_public_id"`
	LorePublicID    string `json:"lore_public_id"`
	Search          string `json:"search"`
	Replace         string `json:"replace"`
	IsRegex         bool   `json:"is_regex"`
}

type storytellerLoreSearchReplaceOutput struct {
	storytellerLoreDetail
	storytellerSearchReplaceOutput
}

type storytellerLoreVersionArguments struct {
	ProjectPublicID string `json:"project_public_id"`
	LorePublicID    string `json:"lore_public_id"`
	TargetVersionID uint64 `json:"target_version_id"`
}

type storytellerGetLoreVersionArguments struct {
	ProjectPublicID string `json:"project_public_id"`
	LorePublicID    string `json:"lore_public_id"`
	VersionID       uint64 `json:"version_id"`
}

// storytellerLoreVersionSummary 是設定集版本列表專用輸出，刻意不含 Content，避免 MCP 列表回應過大。
type storytellerLoreVersionSummary struct {
	ID                      uint64    `json:"id"`
	Title                   string    `json:"title"`
	WordCount               uint      `json:"word_count"`
	RevertedFromVersionID   *uint64   `json:"reverted_from_version_id"`
	ConflictedWithVersionID *uint64   `json:"conflicted_with_version_id"`
	CreatedAt               time.Time `json:"created_at"`
}

type storytellerMoveLoreArguments struct {
	ProjectPublicID string `json:"project_public_id"`
	LorePublicID    string `json:"lore_public_id"`
	CollectionID    string `json:"collection_id"`
}

type storytellerLoreCollectionArguments struct {
	ProjectPublicID    string `json:"project_public_id"`
	CollectionPublicID string `json:"collection_public_id"`
}

type storytellerUpsertLoreCollectionArguments struct {
	ProjectPublicID    string `json:"project_public_id"`
	CollectionPublicID string `json:"collection_public_id"`
	Name               string `json:"name"`
	Description        string `json:"description"`
	Sort               int    `json:"sort"`
}

func storytellerLoreToolSpecs() []ToolSpec {
	return []ToolSpec{
		ToolSpec{
			Name: "storyteller_list_lores",
			Description: "Paginate a project's lore/worldbuilding entries (titles only, use storyteller_get_lore for full content). " +
				"Use this when a project has more lores than storyteller_get_project's embedded list shows (see its lore_count).",
			InputSchema: objectSchema(map[string]interface{}{
				"project_public_id": stringSchema("Project public_id."),
				"collection_id":     stringSchema("Optional lore collection public_id. Omit for all lores, or pass __uncategorized__ for uncategorized lores."),
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
				lores, total, err := NewService().LoresPage(userID, args.ProjectPublicID, args.CollectionID, page, pageSize)
				if err != nil {
					return nil, err
				}
				summaries := make([]storytellerLoreSummary, 0, len(lores))
				for _, lore := range lores {
					summaries = append(summaries, toStorytellerLoreSummary(lore))
				}
				return storytellerLoreListOutput{
					Lores:      summaries,
					TotalCount: total,
					Page:       page,
					PageSize:   pageSize,
				}, nil
			},
		},

		ToolSpec{
			Name:        "storyteller_list_lore_collections",
			Description: "List lore/worldbuilding collections belonging to a storyteller project, including lore counts.",
			InputSchema: objectSchema(map[string]interface{}{
				"project_public_id": stringSchema("Project public_id."),
			}, []string{"project_public_id"}),
			Handler: func(ctx context.Context, arguments map[string]interface{}) (interface{}, error) {
				userID, err := storytellerUserIDFromContext(ctx)
				if err != nil {
					return nil, err
				}
				var args storytellerLoreCollectionArguments
				if err := decodeArguments(arguments, &args); err != nil {
					return nil, err
				}
				collections, err := NewService().LoreCollections(userID, args.ProjectPublicID)
				if err != nil {
					return nil, err
				}
				return collections, nil
			},
		},

		ToolSpec{
			Name:        "storyteller_create_lore_collection",
			Description: "Create a lore/worldbuilding collection inside a storyteller project.",
			InputSchema: objectSchema(map[string]interface{}{
				"project_public_id": stringSchema("Project public_id."),
				"name":              stringSchema("Collection name."),
				"description":       stringSchema("Optional note describing what this lore collection is for."),
				"sort":              integerSchema("Display order among lore collections."),
			}, []string{"project_public_id", "name"}),
			Handler: func(ctx context.Context, arguments map[string]interface{}) (interface{}, error) {
				userID, err := storytellerUserIDFromContext(ctx)
				if err != nil {
					return nil, err
				}
				var args storytellerUpsertLoreCollectionArguments
				if err := decodeArguments(arguments, &args); err != nil {
					return nil, err
				}
				collection, err := NewService().CreateLoreCollection(userID, args.ProjectPublicID, storytellerModel.LoreCollectionRequest{Name: args.Name, Description: args.Description, Sort: args.Sort})
				if err != nil {
					return nil, err
				}
				return collection, nil
			},
		},

		ToolSpec{
			Name:        "storyteller_update_lore_collection",
			Description: "Rename a lore/worldbuilding collection, update its note, or update its display order.",
			InputSchema: objectSchema(map[string]interface{}{
				"project_public_id":    stringSchema("Project public_id."),
				"collection_public_id": stringSchema("Lore collection public_id."),
				"name":                 stringSchema("Collection name."),
				"description":          stringSchema("Optional note describing what this lore collection is for."),
				"sort":                 integerSchema("Display order among lore collections."),
			}, []string{"project_public_id", "collection_public_id", "name"}),
			Handler: func(ctx context.Context, arguments map[string]interface{}) (interface{}, error) {
				userID, err := storytellerUserIDFromContext(ctx)
				if err != nil {
					return nil, err
				}
				var args storytellerUpsertLoreCollectionArguments
				if err := decodeArguments(arguments, &args); err != nil {
					return nil, err
				}
				collection, err := NewService().UpdateLoreCollection(userID, args.ProjectPublicID, args.CollectionPublicID, storytellerModel.LoreCollectionRequest{Name: args.Name, Description: args.Description, Sort: args.Sort})
				if err != nil {
					return nil, err
				}
				return collection, nil
			},
		},

		ToolSpec{
			Name:        "storyteller_delete_lore_collection",
			Description: "Soft-delete an empty lore/worldbuilding collection. Fails while the collection still contains lores.",
			InputSchema: objectSchema(map[string]interface{}{
				"project_public_id":    stringSchema("Project public_id."),
				"collection_public_id": stringSchema("Lore collection public_id."),
			}, []string{"project_public_id", "collection_public_id"}),
			Handler: func(ctx context.Context, arguments map[string]interface{}) (interface{}, error) {
				userID, err := storytellerUserIDFromContext(ctx)
				if err != nil {
					return nil, err
				}
				var args storytellerLoreCollectionArguments
				if err := decodeArguments(arguments, &args); err != nil {
					return nil, err
				}
				if err := NewService().DeleteLoreCollection(userID, args.ProjectPublicID, args.CollectionPublicID); err != nil {
					return nil, err
				}
				return "deleted", nil
			},
		},

		ToolSpec{
			Name:        "storyteller_move_lore",
			Description: "Move a lore/worldbuilding entry into a lore collection, or pass an empty collection_id to make it uncategorized.",
			InputSchema: objectSchema(map[string]interface{}{
				"project_public_id": stringSchema("Project public_id."),
				"lore_public_id":    stringSchema("Lore public_id."),
				"collection_id":     stringSchema("Target lore collection public_id. Empty string moves the lore back to uncategorized."),
			}, []string{"project_public_id", "lore_public_id"}),
			Handler: func(ctx context.Context, arguments map[string]interface{}) (interface{}, error) {
				userID, err := storytellerUserIDFromContext(ctx)
				if err != nil {
					return nil, err
				}
				var args storytellerMoveLoreArguments
				if err := decodeArguments(arguments, &args); err != nil {
					return nil, err
				}
				lore, err := NewService().MoveLore(userID, args.ProjectPublicID, args.LorePublicID, storytellerModel.LoreMoveRequest{CollectionID: args.CollectionID})
				if err != nil {
					return nil, err
				}
				return toStorytellerLoreSummary(*lore), nil
			},
		},

		ToolSpec{
			Name: "storyteller_get_lore",
			Description: "Get a lore/worldbuilding entry's full content by project_public_id and lore_public_id. " +
				"The returned version_id should be kept and passed back as base_version_id on storyteller_upsert_lore " +
				"to detect if someone else (e.g. the web editor) changed it in the meantime. " +
				storytellerContentMarkerHint,
			InputSchema: objectSchema(map[string]interface{}{
				"project_public_id": stringSchema("Project public_id."),
				"lore_public_id":    stringSchema("Lore public_id, as returned by storyteller_get_project."),
			}, []string{"project_public_id", "lore_public_id"}),
			Handler: func(ctx context.Context, arguments map[string]interface{}) (interface{}, error) {
				userID, err := storytellerUserIDFromContext(ctx)
				if err != nil {
					return nil, err
				}
				var args storytellerLoreArguments
				if err := decodeArguments(arguments, &args); err != nil {
					return nil, err
				}
				lore, err := NewService().Lore(userID, args.ProjectPublicID, args.LorePublicID)
				if err != nil {
					return nil, err
				}
				return storytellerLoreDetail{
					storytellerLoreSummary: toStorytellerLoreSummary(*lore),
					VersionID:              derefUint64(lore.LatestVersionID),
					Content:                lore.LatestContent,
				}, nil
			},
		},

		ToolSpec{
			Name: "storyteller_upsert_lore",
			Description: "Create or update a lore/worldbuilding entry. Omit lore_public_id to create a new one; " +
				"pass an existing lore_public_id to overwrite its content (this creates a new version, the previous content is not lost). " +
				"Pass base_version_id (from storyteller_get_lore) to detect if someone else's edit happened in the meantime: the write " +
				"always succeeds and is saved as a new version either way, but the response's version_conflict is true if the entry had " +
				"moved on past base_version_id — consider re-fetching with storyteller_get_lore afterwards to check nothing important got lost.",
			InputSchema: objectSchema(map[string]interface{}{
				"project_public_id": stringSchema("Project public_id."),
				"lore_public_id": stringSchema("Existing lore public_id to update. Omit ONLY when you actually want to create a brand " +
					"new, separate lore entry — omitting it while intending to update an existing one (e.g. \"@thisLore\" or an " +
					"entry you just read via storyteller_get_lore/storyteller_list_lores) silently creates a duplicate instead of " +
					"updating it. If you have a lore_public_id in hand for the item you mean, always pass it back here."),
				"title":         stringSchema("Lore title, required."),
				"collection_id": stringSchema("Optional lore collection public_id. Omit to preserve the current collection on update; pass empty string or __uncategorized__ to clear it."),
				"content": stringSchema(
					"Full lore content, required. Writing the content into your chat reply instead of this argument does " +
						"NOT count — the proposal card shown to the user is built purely from this argument, so if you leave " +
						"it out the user sees an empty diff and an empty overwrite. " + storytellerContentSyntaxHint + " " + storytellerContentMarkerHint,
				),
				"base_version_id": integerSchema("Optional. The version_id you last read via storyteller_get_lore; the response's version_conflict flags if the entry has moved on since, but the write still always happens."),
			}, []string{"project_public_id", "title", "content"}),
			Handler: func(ctx context.Context, arguments map[string]interface{}) (interface{}, error) {
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
					CollectionID:  args.CollectionID,
					Content:       args.Content,
					BaseVersionID: args.BaseVersionID,
				}
				source := storytellerSourceFromContext(ctx)
				service := NewService()
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
				return storytellerLoreDetail{
					storytellerLoreSummary: toStorytellerLoreSummary(*lore),
					Content:                lore.LatestContent,
					VersionID:              derefUint64(lore.LatestVersionID),
					VersionConflict:        conflicted,
				}, nil
			},
		},

		ToolSpec{
			Name: "storyteller_list_lore_versions",
			Description: "List a lore/worldbuilding entry's version history by project_public_id and lore_public_id. " +
				"This returns summary metadata only and does not include full content; use storyteller_get_lore_version " +
				"to read one version's full content, or storyteller_revert_lore to restore a version.",
			InputSchema: objectSchema(map[string]interface{}{
				"project_public_id": stringSchema("Project public_id."),
				"lore_public_id":    stringSchema("Lore public_id."),
			}, []string{"project_public_id", "lore_public_id"}),
			Handler: func(ctx context.Context, arguments map[string]interface{}) (interface{}, error) {
				userID, err := storytellerUserIDFromContext(ctx)
				if err != nil {
					return nil, err
				}
				var args storytellerLoreArguments
				if err := decodeArguments(arguments, &args); err != nil {
					return nil, err
				}
				versions, err := NewService().LoreVersions(userID, args.ProjectPublicID, args.LorePublicID)
				if err != nil {
					return nil, err
				}
				summaries := make([]storytellerLoreVersionSummary, 0, len(versions))
				for _, version := range versions {
					summaries = append(summaries, storytellerLoreVersionSummary{
						ID:                      version.ID,
						Title:                   version.Title,
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
			Name: "storyteller_get_lore_version",
			Description: "Get one lore/worldbuilding version's full content by project_public_id, lore_public_id, and version_id. " +
				"Use storyteller_list_lore_versions to find candidate version ids first; use storyteller_revert_lore " +
				"if you decide to restore one of them.",
			InputSchema: objectSchema(map[string]interface{}{
				"project_public_id": stringSchema("Project public_id."),
				"lore_public_id":    stringSchema("Lore public_id."),
				"version_id":        integerSchema("Version id to read."),
			}, []string{"project_public_id", "lore_public_id", "version_id"}),
			Handler: func(ctx context.Context, arguments map[string]interface{}) (interface{}, error) {
				userID, err := storytellerUserIDFromContext(ctx)
				if err != nil {
					return nil, err
				}
				var args storytellerGetLoreVersionArguments
				if err := decodeArguments(arguments, &args); err != nil {
					return nil, err
				}
				return NewService().LoreVersion(userID, args.ProjectPublicID, args.LorePublicID, args.VersionID)
			},
		},

		ToolSpec{
			Name: "storyteller_revert_lore",
			Description: "Revert a lore/worldbuilding entry to a previous version by creating a new latest version from target_version_id. " +
				"target_version_id can come from storyteller_list_lore_versions, or from storyteller_get_lore when restoring " +
				"the current latest version id after checking the latest content.",
			InputSchema: objectSchema(map[string]interface{}{
				"project_public_id": stringSchema("Project public_id."),
				"lore_public_id":    stringSchema("Lore public_id."),
				"target_version_id": integerSchema("Version id to restore from."),
			}, []string{"project_public_id", "lore_public_id", "target_version_id"}),
			Handler: func(ctx context.Context, arguments map[string]interface{}) (interface{}, error) {
				userID, err := storytellerUserIDFromContext(ctx)
				if err != nil {
					return nil, err
				}
				var args storytellerLoreVersionArguments
				if err := decodeArguments(arguments, &args); err != nil {
					return nil, err
				}
				lore, err := NewService().RevertLore(userID, args.ProjectPublicID, args.LorePublicID, args.TargetVersionID, "mcp")
				if err != nil {
					return nil, err
				}
				return storytellerLoreDetail{
					storytellerLoreSummary: toStorytellerLoreSummary(*lore),
					Content:                lore.LatestContent,
					VersionID:              derefUint64(lore.LatestVersionID),
				}, nil
			},
		},

		ToolSpec{
			Name: "storyteller_patch_lore",
			Description: "Patch selected fields on an existing lore/worldbuilding entry. Omit a field to leave it unchanged. " +
				"This is deliberately different from storyteller_upsert_lore: upsert has full-overwrite semantics, " +
				"so omitting title/content there overwrites them with empty values. Use this tool when you only want to change specific fields. " +
				"At least one of title or content must be provided. collection_id is optional and only changes collection membership when present; empty string or __uncategorized__ clears it.",
			InputSchema: objectSchema(map[string]interface{}{
				"project_public_id": stringSchema("Project public_id."),
				"lore_public_id":    stringSchema("Existing lore public_id to patch."),
				"title":             stringSchema("Optional. New lore title. Omit to keep the current title."),
				"content":           stringSchema("Optional. New full content. Omit to keep the current content. " + storytellerContentSyntaxHint + " " + storytellerContentMarkerHint),
				"collection_id":     stringSchema("Optional. Omit to keep current collection membership; pass empty string or __uncategorized__ to clear it; pass a lore collection public_id to move it there."),
				"base_version_id":   integerSchema("Optional. The version_id you last read via storyteller_get_lore; version_conflict flags if the lore has moved on since, but the write still happens."),
			}, []string{"project_public_id", "lore_public_id"}),
			Handler: func(ctx context.Context, arguments map[string]interface{}) (interface{}, error) {
				userID, err := storytellerUserIDFromContext(ctx)
				if err != nil {
					return nil, err
				}
				var args storytellerPatchLoreArguments
				if err := decodeArguments(arguments, &args); err != nil {
					return nil, err
				}
				if !args.hasContentField() {
					return nil, errors.New("at least one field to update must be specified")
				}
				service := NewService()
				current, err := service.Lore(userID, args.ProjectPublicID, args.LorePublicID)
				if err != nil {
					return nil, err
				}
				input := mergeLorePatch(current, args)
				lore, conflicted, err := service.UpdateLore(userID, args.ProjectPublicID, args.LorePublicID, input, storytellerSourceFromContext(ctx))
				if err != nil {
					return nil, err
				}
				return storytellerLoreDetail{
					storytellerLoreSummary: toStorytellerLoreSummary(*lore),
					Content:                lore.LatestContent,
					VersionID:              derefUint64(lore.LatestVersionID),
					VersionConflict:        conflicted,
				}, nil
			},
		},

		ToolSpec{
			Name: "storyteller_search_replace_lore",
			Description: "Search and replace inside one existing lore/worldbuilding entry, writing directly with no dry run. " +
				"Search is case-sensitive. When is_regex is false, search is treated as a literal string via regexp.QuoteMeta; when true, search uses Go RE2 regexp syntax and replace may use $1/${name} capture references. " +
				"If match_count is 0, nothing is written and no new version is created; otherwise this saves through the same versioned path as storyteller_upsert_lore.",
			InputSchema: objectSchema(map[string]interface{}{
				"project_public_id": stringSchema("Project public_id."),
				"lore_public_id":    stringSchema("Existing lore public_id to edit."),
				"search":            stringSchema("Required search text or RE2 regexp pattern. Case-sensitive unless is_regex=true and you include an inline flag such as (?i)."),
				"replace":           stringSchema("Required replacement text. When is_regex=true, Go regexp replacement references such as $1 and ${name} are supported."),
				"is_regex":          booleanSchema("Optional, defaults to false. false means literal search; true means compile search as a Go RE2 regexp."),
			}, []string{"project_public_id", "lore_public_id", "search", "replace"}),
			Handler: func(ctx context.Context, arguments map[string]interface{}) (interface{}, error) {
				userID, err := storytellerUserIDFromContext(ctx)
				if err != nil {
					return nil, err
				}
				var args storytellerSearchReplaceLoreArguments
				if err := decodeArguments(arguments, &args); err != nil {
					return nil, err
				}
				pattern, err := compileStorytellerSearchPattern(args.Search, args.IsRegex)
				if err != nil {
					return nil, err
				}
				service := NewService()
				current, err := service.Lore(userID, args.ProjectPublicID, args.LorePublicID)
				if err != nil {
					return nil, err
				}
				content, matchCount := replaceAllCounting(pattern, current.LatestContent, args.Replace)
				stats := storytellerSearchReplaceOutput{MatchCount: matchCount, TextMatchCount: matchCount}
				if matchCount == 0 {
					return storytellerLoreSearchReplaceOutput{
						storytellerLoreDetail: storytellerLoreDetail{
							storytellerLoreSummary: toStorytellerLoreSummary(*current),
							Content:                current.LatestContent,
							VersionID:              derefUint64(current.LatestVersionID),
						},
						storytellerSearchReplaceOutput: stats,
					}, nil
				}
				input := storytellerModel.LoreRequest{
					Title:         current.Title,
					Content:       content,
					BaseVersionID: current.LatestVersionID,
				}
				lore, conflicted, err := service.UpdateLore(userID, args.ProjectPublicID, args.LorePublicID, input, storytellerSourceFromContext(ctx))
				if err != nil {
					return nil, err
				}
				return storytellerLoreSearchReplaceOutput{
					storytellerLoreDetail: storytellerLoreDetail{
						storytellerLoreSummary: toStorytellerLoreSummary(*lore),
						Content:                lore.LatestContent,
						VersionID:              derefUint64(lore.LatestVersionID),
						VersionConflict:        conflicted,
					},
					storytellerSearchReplaceOutput: stats,
				}, nil
			},
		},

		ToolSpec{
			Name:        "storyteller_delete_lore",
			Description: "Delete a lore/worldbuilding entry by project_public_id and lore_public_id.",
			InputSchema: objectSchema(map[string]interface{}{
				"project_public_id": stringSchema("Project public_id."),
				"lore_public_id":    stringSchema("Lore public_id."),
			}, []string{"project_public_id", "lore_public_id"}),
			Handler: func(ctx context.Context, arguments map[string]interface{}) (interface{}, error) {
				userID, err := storytellerUserIDFromContext(ctx)
				if err != nil {
					return nil, err
				}
				var args storytellerLoreArguments
				if err := decodeArguments(arguments, &args); err != nil {
					return nil, err
				}
				if err := NewService().DeleteLore(userID, args.ProjectPublicID, args.LorePublicID); err != nil {
					return nil, err
				}
				return "deleted", nil
			},
		},
	}
}

func mergeLorePatch(lore *storytellerModel.Lore, args storytellerPatchLoreArguments) storytellerModel.LoreRequest {
	input := storytellerModel.LoreRequest{
		Title:         lore.Title,
		Content:       lore.LatestContent,
		CollectionID:  args.CollectionID,
		BaseVersionID: args.BaseVersionID,
	}
	if args.Title != nil {
		input.Title = *args.Title
	}
	if args.Content != nil {
		input.Content = *args.Content
	}
	return input
}
