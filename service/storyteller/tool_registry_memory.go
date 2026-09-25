package storyteller

import (
	"context"

	storytellerModel "faryne.dev/model/entity/storyteller"
)

type storytellerListMemoriesArguments struct {
	ProjectPublicID string `json:"project_public_id"`
	StoryPublicID   string `json:"story_public_id"`
	LorePublicID    string `json:"lore_public_id"`
	Limit           int    `json:"limit"`
}

type storytellerSearchMemoriesArguments struct {
	ProjectPublicID string `json:"project_public_id"`
	StoryPublicID   string `json:"story_public_id"`
	LorePublicID    string `json:"lore_public_id"`
	Keyword         string `json:"keyword"`
	Limit           int    `json:"limit"`
}

func storytellerMemoryToolSpecs() []ToolSpec {
	return []ToolSpec{
		{
			Name: "storyteller_list_memories",
			Description: "List Suosuo's active memories relevant to the authenticated user and current writing scope. " +
				"The result always includes account-wide and project memories; provide either story_public_id or lore_public_id " +
				"to also include memories specific to that story or lore entry. Never provide both target ids.",
			InputSchema: objectSchema(map[string]interface{}{
				"project_public_id": stringSchema("Project public_id that defines the authorized workspace scope."),
				"story_public_id":   stringSchema("Optional story public_id in this project. Mutually exclusive with lore_public_id."),
				"lore_public_id":    stringSchema("Optional lore public_id in this project. Mutually exclusive with story_public_id."),
				"limit":             integerSchema("Maximum memories to return. Defaults to 50 and is capped at 100."),
			}, []string{"project_public_id"}),
			Handler: func(ctx context.Context, arguments map[string]interface{}) (interface{}, error) {
				userID, err := storytellerUserIDFromContext(ctx)
				if err != nil {
					return nil, err
				}
				var args storytellerListMemoriesArguments
				if err := decodeArguments(arguments, &args); err != nil {
					return nil, err
				}
				return NewService().AssistantMemories(userID, args.ProjectPublicID, args.StoryPublicID, args.LorePublicID, args.Limit)
			},
		},
		{
			Name:        "storyteller_search_memories",
			Description: "Search Suosuo's active memories by keyword in the authenticated user's account, project, and optional current story/lore scope.",
			InputSchema: objectSchema(map[string]interface{}{
				"project_public_id": stringSchema("Project public_id that defines the authorized workspace scope."),
				"story_public_id":   stringSchema("Optional story public_id in this project. Mutually exclusive with lore_public_id."),
				"lore_public_id":    stringSchema("Optional lore public_id in this project. Mutually exclusive with story_public_id."),
				"keyword":           stringSchema("Required keyword, 1 to 100 characters."),
				"limit":             integerSchema("Maximum matches. Defaults to 50 and is capped at 100."),
			}, []string{"project_public_id", "keyword"}),
			Handler: func(ctx context.Context, arguments map[string]interface{}) (interface{}, error) {
				userID, err := storytellerUserIDFromContext(ctx)
				if err != nil {
					return nil, err
				}
				var args storytellerSearchMemoriesArguments
				if err := decodeArguments(arguments, &args); err != nil {
					return nil, err
				}
				return NewService().SearchAssistantMemories(userID, args.ProjectPublicID, args.StoryPublicID, args.LorePublicID, args.Keyword, args.Limit)
			},
		},
	}
}

func storytellerMemoryMCPOnlyToolSpecs() []ToolSpec {
	return []ToolSpec{{
		Name: "storyteller_upsert_memory",
		Description: "Create or update one of Suosuo's confirmed memories. Scope must be explicit. " +
			"Pass memory_public_id to update a stable memory; omit it to create one. project_public_id is always required for authorization.",
		InputSchema: objectSchema(map[string]interface{}{
			"memory_public_id":  stringSchema("Optional stable memory public_id. Omit to create a new memory."),
			"project_public_id": stringSchema("Project public_id used to authorize and resolve project/story/lore scope."),
			"story_public_id":   stringSchema("Required only for story scope."),
			"lore_public_id":    stringSchema("Required only for lore scope."),
			"memory_name":       stringSchema("Optional display name, at most 255 characters."),
			"scope_type":        enumStringSchema("Explicit memory scope.", "account", "project", "story", "lore"),
			"kind":              enumStringSchema("Memory classification.", "preference", "instruction", "decision", "context"),
			"content":           stringSchema("Atomic, self-contained memory content, at most 2000 characters."),
			"priority":          integerSchema("Retrieval priority from 0 to 100."),
			"is_pinned":         booleanSchema("Pinned memories cannot be superseded automatically."),
		}, []string{"project_public_id", "scope_type", "kind", "content"}),
		Handler: func(ctx context.Context, arguments map[string]interface{}) (interface{}, error) {
			userID, err := storytellerUserIDFromContext(ctx)
			if err != nil {
				return nil, err
			}
			var args storytellerModel.AssistantMemoryUpsertRequest
			if err := decodeArguments(arguments, &args); err != nil {
				return nil, err
			}
			return NewService().UpsertAssistantMemory(userID, args)
		},
	}}
}
