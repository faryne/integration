package storyteller

import (
	"context"

	storytellerModel "faryne.dev/model/entity/storyteller"
)

func storytellerChapterReadToolSpecs() []ToolSpec {
	return []ToolSpec{
		{
			Name:        "storyteller_list_story_chapters",
			Description: "List chapter summaries for a text story. A chapter starts at any H1-H6 heading and ends before the next heading of any level. Returns marker_id values for get/replace/insert/delete chapter tools.",
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
				story, err := NewService().Story(userID, args.ProjectPublicID, args.StoryPublicID)
				if err != nil {
					return nil, err
				}
				return storytellerChapterSummaries(story.LatestContent), nil
			},
		},
		{
			Name:        "storyteller_get_story_chapter",
			Description: "Get one story chapter by marker_id. The content includes the heading line and original paragraph marker wrappers; preserve the heading marker when renaming if you want marker_id to stay stable.",
			InputSchema: objectSchema(map[string]interface{}{
				"project_public_id": stringSchema("Project public_id."),
				"story_public_id":   stringSchema("Story public_id."),
				"marker_id":         stringSchema("Heading marker_id from storyteller_list_story_chapters."),
			}, []string{"project_public_id", "story_public_id", "marker_id"}),
			Handler: func(ctx context.Context, arguments map[string]interface{}) (interface{}, error) {
				userID, err := storytellerUserIDFromContext(ctx)
				if err != nil {
					return nil, err
				}
				var args storytellerStoryChapterArguments
				if err := decodeArguments(arguments, &args); err != nil {
					return nil, err
				}
				story, err := NewService().Story(userID, args.ProjectPublicID, args.StoryPublicID)
				if err != nil {
					return nil, err
				}
				return storytellerChapterDetailByMarker(story.LatestContent, args.MarkerID, derefUint64(story.LatestVersionID))
			},
		},
		{
			Name:        "storyteller_list_lore_chapters",
			Description: "List chapter summaries for a lore/worldbuilding entry. A chapter starts at any H1-H6 heading and ends before the next heading of any level. Returns marker_id values for get/replace/insert/delete chapter tools.",
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
				lore, err := NewService().Lore(userID, args.ProjectPublicID, args.LorePublicID)
				if err != nil {
					return nil, err
				}
				return storytellerChapterSummaries(lore.LatestContent), nil
			},
		},
		{
			Name:        "storyteller_get_lore_chapter",
			Description: "Get one lore/worldbuilding chapter by marker_id. The content includes the heading line and original paragraph marker wrappers; preserve the heading marker when renaming if you want marker_id to stay stable.",
			InputSchema: objectSchema(map[string]interface{}{
				"project_public_id": stringSchema("Project public_id."),
				"lore_public_id":    stringSchema("Lore public_id."),
				"marker_id":         stringSchema("Heading marker_id from storyteller_list_lore_chapters."),
			}, []string{"project_public_id", "lore_public_id", "marker_id"}),
			Handler: func(ctx context.Context, arguments map[string]interface{}) (interface{}, error) {
				userID, err := storytellerUserIDFromContext(ctx)
				if err != nil {
					return nil, err
				}
				var args storytellerLoreChapterArguments
				if err := decodeArguments(arguments, &args); err != nil {
					return nil, err
				}
				lore, err := NewService().Lore(userID, args.ProjectPublicID, args.LorePublicID)
				if err != nil {
					return nil, err
				}
				return storytellerChapterDetailByMarker(lore.LatestContent, args.MarkerID, derefUint64(lore.LatestVersionID))
			},
		},
	}
}

func storytellerChapterWriteToolSpecs() []ToolSpec {
	return []ToolSpec{
		{
			Name:        "storyteller_replace_story_chapter",
			Description: "Replace one story chapter by heading marker_id. content must start with a heading line and include the whole new chapter. Preserve the original heading marker wrapper to keep marker_id stable; the response returns the post-save marker_id/heading_level/title after re-scanning.",
			InputSchema: objectSchema(map[string]interface{}{
				"project_public_id": stringSchema("Project public_id."),
				"story_public_id":   stringSchema("Story public_id."),
				"marker_id":         stringSchema("Heading marker_id from storyteller_list_story_chapters."),
				"content":           stringSchema("New full chapter content, including its heading line. " + storytellerContentSyntaxHint + " " + storytellerContentMarkerHint),
				"base_version_id":   integerSchema("Optional. The version_id you last read via storyteller_get_story or storyteller_get_story_chapter; version_conflict flags if the story has moved on since, but the write still happens."),
			}, []string{"project_public_id", "story_public_id", "marker_id", "content"}),
			Handler: replaceStoryChapter,
		},
		{
			Name:        "storyteller_insert_story_chapter",
			Description: "Insert a new story chapter. content must start with a heading line. Pass after_marker_id to insert after an existing chapter; omit it to append at the end. The response returns the post-save marker_id/heading_level/title after re-scanning.",
			InputSchema: objectSchema(map[string]interface{}{
				"project_public_id": stringSchema("Project public_id."),
				"story_public_id":   stringSchema("Story public_id."),
				"content":           stringSchema("New full chapter content, starting with its heading line. " + storytellerContentSyntaxHint + " " + storytellerContentMarkerHint),
				"after_marker_id":   stringSchema("Optional. Heading marker_id of the chapter to insert after. Omit or pass empty string to append at the end."),
				"base_version_id":   integerSchema("Optional. The version_id you last read via storyteller_get_story or storyteller_get_story_chapter; version_conflict flags if the story has moved on since, but the write still happens."),
			}, []string{"project_public_id", "story_public_id", "content"}),
			Handler: insertStoryChapter,
		},
		{
			Name:        "storyteller_delete_story_chapter",
			Description: "Delete one story chapter by heading marker_id. The removed range includes the heading line and every following line before the next heading of any level.",
			InputSchema: objectSchema(map[string]interface{}{
				"project_public_id": stringSchema("Project public_id."),
				"story_public_id":   stringSchema("Story public_id."),
				"marker_id":         stringSchema("Heading marker_id from storyteller_list_story_chapters."),
				"base_version_id":   integerSchema("Optional. The version_id you last read via storyteller_get_story or storyteller_get_story_chapter; version_conflict flags if the story has moved on since, but the write still happens."),
			}, []string{"project_public_id", "story_public_id", "marker_id"}),
			Handler: deleteStoryChapter,
		},
		{
			Name:        "storyteller_replace_lore_chapter",
			Description: "Replace one lore/worldbuilding chapter by heading marker_id. content must start with a heading line and include the whole new chapter. Preserve the original heading marker wrapper to keep marker_id stable; the response returns the post-save marker_id/heading_level/title after re-scanning.",
			InputSchema: objectSchema(map[string]interface{}{
				"project_public_id": stringSchema("Project public_id."),
				"lore_public_id":    stringSchema("Lore public_id."),
				"marker_id":         stringSchema("Heading marker_id from storyteller_list_lore_chapters."),
				"content":           stringSchema("New full chapter content, including its heading line. " + storytellerContentSyntaxHint + " " + storytellerContentMarkerHint),
				"base_version_id":   integerSchema("Optional. The version_id you last read via storyteller_get_lore or storyteller_get_lore_chapter; version_conflict flags if the lore has moved on since, but the write still happens."),
			}, []string{"project_public_id", "lore_public_id", "marker_id", "content"}),
			Handler: replaceLoreChapter,
		},
		{
			Name:        "storyteller_insert_lore_chapter",
			Description: "Insert a new lore/worldbuilding chapter. content must start with a heading line. Pass after_marker_id to insert after an existing chapter; omit it to append at the end. The response returns the post-save marker_id/heading_level/title after re-scanning.",
			InputSchema: objectSchema(map[string]interface{}{
				"project_public_id": stringSchema("Project public_id."),
				"lore_public_id":    stringSchema("Lore public_id."),
				"content":           stringSchema("New full chapter content, starting with its heading line. " + storytellerContentSyntaxHint + " " + storytellerContentMarkerHint),
				"after_marker_id":   stringSchema("Optional. Heading marker_id of the chapter to insert after. Omit or pass empty string to append at the end."),
				"base_version_id":   integerSchema("Optional. The version_id you last read via storyteller_get_lore or storyteller_get_lore_chapter; version_conflict flags if the lore has moved on since, but the write still happens."),
			}, []string{"project_public_id", "lore_public_id", "content"}),
			Handler: insertLoreChapter,
		},
		{
			Name:        "storyteller_delete_lore_chapter",
			Description: "Delete one lore/worldbuilding chapter by heading marker_id. The removed range includes the heading line and every following line before the next heading of any level.",
			InputSchema: objectSchema(map[string]interface{}{
				"project_public_id": stringSchema("Project public_id."),
				"lore_public_id":    stringSchema("Lore public_id."),
				"marker_id":         stringSchema("Heading marker_id from storyteller_list_lore_chapters."),
				"base_version_id":   integerSchema("Optional. The version_id you last read via storyteller_get_lore or storyteller_get_lore_chapter; version_conflict flags if the lore has moved on since, but the write still happens."),
			}, []string{"project_public_id", "lore_public_id", "marker_id"}),
			Handler: deleteLoreChapter,
		},
	}
}

func replaceStoryChapter(ctx context.Context, arguments map[string]interface{}) (interface{}, error) {
	userID, err := storytellerUserIDFromContext(ctx)
	if err != nil {
		return nil, err
	}
	var args storytellerReplaceStoryChapterArguments
	if err := decodeArguments(arguments, &args); err != nil {
		return nil, err
	}
	if err := validateChapterContentStartsWithHeading(args.Content); err != nil {
		return nil, err
	}
	service := NewService()
	current, err := service.Story(userID, args.ProjectPublicID, args.StoryPublicID)
	if err != nil {
		return nil, err
	}
	span, _, ok := findStoryChapterSpan(storyChapterSpans(current.LatestContent), args.MarkerID)
	if !ok {
		return nil, errStoryChapterNotFound(args.MarkerID)
	}
	nextContent, startLine := replaceStoryChapterContent(current.LatestContent, span, args.Content)
	story, conflicted, err := service.UpdateStory(userID, args.ProjectPublicID, args.StoryPublicID, storytellerModel.StoryRequest{
		Title:         current.Title,
		Summary:       current.Summary,
		Status:        current.Status,
		Sort:          current.Sort,
		Content:       nextContent,
		BaseVersionID: args.BaseVersionID,
		ContentType:   current.ContentType,
	}, storytellerSourceFromContext(ctx))
	if err != nil {
		return nil, err
	}
	return storytellerChapterWriteOutputAfterSave(story.LatestContent, startLine, derefUint64(story.LatestVersionID), conflicted)
}

func insertStoryChapter(ctx context.Context, arguments map[string]interface{}) (interface{}, error) {
	userID, err := storytellerUserIDFromContext(ctx)
	if err != nil {
		return nil, err
	}
	var args storytellerInsertStoryChapterArguments
	if err := decodeArguments(arguments, &args); err != nil {
		return nil, err
	}
	if err := validateChapterContentStartsWithHeading(args.Content); err != nil {
		return nil, err
	}
	service := NewService()
	current, err := service.Story(userID, args.ProjectPublicID, args.StoryPublicID)
	if err != nil {
		return nil, err
	}
	nextContent, startLine, err := insertStoryChapterContent(current.LatestContent, args.AfterMarkerID, args.Content)
	if err != nil {
		return nil, err
	}
	story, conflicted, err := service.UpdateStory(userID, args.ProjectPublicID, args.StoryPublicID, storytellerModel.StoryRequest{
		Title:         current.Title,
		Summary:       current.Summary,
		Status:        current.Status,
		Sort:          current.Sort,
		Content:       nextContent,
		BaseVersionID: args.BaseVersionID,
		ContentType:   current.ContentType,
	}, storytellerSourceFromContext(ctx))
	if err != nil {
		return nil, err
	}
	return storytellerChapterWriteOutputAfterSave(story.LatestContent, startLine, derefUint64(story.LatestVersionID), conflicted)
}

func deleteStoryChapter(ctx context.Context, arguments map[string]interface{}) (interface{}, error) {
	userID, err := storytellerUserIDFromContext(ctx)
	if err != nil {
		return nil, err
	}
	var args storytellerDeleteStoryChapterArguments
	if err := decodeArguments(arguments, &args); err != nil {
		return nil, err
	}
	service := NewService()
	current, err := service.Story(userID, args.ProjectPublicID, args.StoryPublicID)
	if err != nil {
		return nil, err
	}
	nextContent, err := deleteStoryChapterContent(current.LatestContent, args.MarkerID)
	if err != nil {
		return nil, err
	}
	story, conflicted, err := service.UpdateStory(userID, args.ProjectPublicID, args.StoryPublicID, storytellerModel.StoryRequest{
		Title:         current.Title,
		Summary:       current.Summary,
		Status:        current.Status,
		Sort:          current.Sort,
		Content:       nextContent,
		BaseVersionID: args.BaseVersionID,
		ContentType:   current.ContentType,
	}, storytellerSourceFromContext(ctx))
	if err != nil {
		return nil, err
	}
	return storytellerChapterDeleteOutput{
		DeletedMarkerID:       args.MarkerID,
		VersionID:             derefUint64(story.LatestVersionID),
		VersionConflict:       conflicted,
		RemainingChapterCount: len(storyChapterSpans(story.LatestContent)),
	}, nil
}

func replaceLoreChapter(ctx context.Context, arguments map[string]interface{}) (interface{}, error) {
	userID, err := storytellerUserIDFromContext(ctx)
	if err != nil {
		return nil, err
	}
	var args storytellerReplaceLoreChapterArguments
	if err := decodeArguments(arguments, &args); err != nil {
		return nil, err
	}
	if err := validateChapterContentStartsWithHeading(args.Content); err != nil {
		return nil, err
	}
	service := NewService()
	current, err := service.Lore(userID, args.ProjectPublicID, args.LorePublicID)
	if err != nil {
		return nil, err
	}
	span, _, ok := findStoryChapterSpan(storyChapterSpans(current.LatestContent), args.MarkerID)
	if !ok {
		return nil, errStoryChapterNotFound(args.MarkerID)
	}
	nextContent, startLine := replaceStoryChapterContent(current.LatestContent, span, args.Content)
	lore, conflicted, err := service.UpdateLore(userID, args.ProjectPublicID, args.LorePublicID, storytellerModel.LoreRequest{
		Title:         current.Title,
		Content:       nextContent,
		BaseVersionID: args.BaseVersionID,
	}, storytellerSourceFromContext(ctx))
	if err != nil {
		return nil, err
	}
	return storytellerChapterWriteOutputAfterSave(lore.LatestContent, startLine, derefUint64(lore.LatestVersionID), conflicted)
}

func insertLoreChapter(ctx context.Context, arguments map[string]interface{}) (interface{}, error) {
	userID, err := storytellerUserIDFromContext(ctx)
	if err != nil {
		return nil, err
	}
	var args storytellerInsertLoreChapterArguments
	if err := decodeArguments(arguments, &args); err != nil {
		return nil, err
	}
	if err := validateChapterContentStartsWithHeading(args.Content); err != nil {
		return nil, err
	}
	service := NewService()
	current, err := service.Lore(userID, args.ProjectPublicID, args.LorePublicID)
	if err != nil {
		return nil, err
	}
	nextContent, startLine, err := insertStoryChapterContent(current.LatestContent, args.AfterMarkerID, args.Content)
	if err != nil {
		return nil, err
	}
	lore, conflicted, err := service.UpdateLore(userID, args.ProjectPublicID, args.LorePublicID, storytellerModel.LoreRequest{
		Title:         current.Title,
		Content:       nextContent,
		BaseVersionID: args.BaseVersionID,
	}, storytellerSourceFromContext(ctx))
	if err != nil {
		return nil, err
	}
	return storytellerChapterWriteOutputAfterSave(lore.LatestContent, startLine, derefUint64(lore.LatestVersionID), conflicted)
}

func deleteLoreChapter(ctx context.Context, arguments map[string]interface{}) (interface{}, error) {
	userID, err := storytellerUserIDFromContext(ctx)
	if err != nil {
		return nil, err
	}
	var args storytellerDeleteLoreChapterArguments
	if err := decodeArguments(arguments, &args); err != nil {
		return nil, err
	}
	service := NewService()
	current, err := service.Lore(userID, args.ProjectPublicID, args.LorePublicID)
	if err != nil {
		return nil, err
	}
	nextContent, err := deleteStoryChapterContent(current.LatestContent, args.MarkerID)
	if err != nil {
		return nil, err
	}
	lore, conflicted, err := service.UpdateLore(userID, args.ProjectPublicID, args.LorePublicID, storytellerModel.LoreRequest{
		Title:         current.Title,
		Content:       nextContent,
		BaseVersionID: args.BaseVersionID,
	}, storytellerSourceFromContext(ctx))
	if err != nil {
		return nil, err
	}
	return storytellerChapterDeleteOutput{
		DeletedMarkerID:       args.MarkerID,
		VersionID:             derefUint64(lore.LatestVersionID),
		VersionConflict:       conflicted,
		RemainingChapterCount: len(storyChapterSpans(lore.LatestContent)),
	}, nil
}
