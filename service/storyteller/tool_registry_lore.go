package storyteller

import (
	"context"

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

type storytellerLoreVersionArguments struct {
	ProjectPublicID string `json:"project_public_id"`
	LorePublicID    string `json:"lore_public_id"`
	TargetVersionID uint64 `json:"target_version_id"`
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
				"lore_public_id":    stringSchema("Existing lore public_id to update. Omit to create a new entry."),
				"title":             stringSchema("Lore title, required."),
				"collection_id":     stringSchema("Optional lore collection public_id. Omit to preserve the current collection on update; pass empty string or __uncategorized__ to clear it."),
				"content": stringSchema(
					"Full lore content. " + storytellerContentSyntaxHint + " " + storytellerContentMarkerHint,
				),
				"base_version_id": integerSchema("Optional. The version_id you last read via storyteller_get_lore; the response's version_conflict flags if the entry has moved on since, but the write still always happens."),
			}, []string{"project_public_id", "title"}),
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
			Name: "storyteller_revert_lore",
			Description: "Revert a lore/worldbuilding entry to a previous version by creating a new latest version from target_version_id. " +
				"There is currently no MCP tool that lists a lore entry's version history; target_version_id can only come " +
				"from storyteller_get_lore (for the current version id) or from the user checking \"編輯歷史\" in the web app.",
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
