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

// storytellerMemoryReadHint 接在 get_story／get_lore 描述尾端，引導外部 AI 寫作前先讀記憶。
// server instructions 被 client 截斷或忽略時，這句是備援；用條件句，梭梭已自動注入記憶時不會多呼叫。
func storytellerMemoryReadHint(targetField string) string {
	return " Before writing based on this content, load the author's memories via storyteller_list_memories " +
		"with the same " + targetField + " if they aren't already in your context."
}

func storytellerMemoryToolSpecs() []ToolSpec {
	return []ToolSpec{
		{
			Name: "storyteller_list_memories",
			Description: "List the author's confirmed writing memories for a project: style preferences, standing instructions, " +
				"settled plot/setting decisions and background that the story text itself doesn't record " +
				"(shown in the web UI as 梭梭的記憶, shared by the built-in assistant and all MCP clients). " +
				"Call this before drafting, continuing, rewriting or reviewing a story or lore entry, unless these memories are already in your context. " +
				"Always returns project-scoped memories; pass story_public_id or lore_public_id (never both) to add memories for that target. " +
				"Narrower scope wins on conflict (story/lore over project); the author's current request overrides any memory.",
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
			Name: "storyteller_search_memories",
			Description: "Search the author's confirmed writing memories by keyword or tag (matches name, content and tags) " +
				"within a project and optional story/lore scope. Use it to check rules about a specific character, term, relationship or scene, " +
				"and before storyteller_upsert_memory to find an existing memory to update instead of creating a duplicate.",
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
		// MCP 寫入會直接變成 confirmed、跳過 Web 端的人工確認，所以「先取得作者同意」要寫在描述本身，
		// 不能只靠 server instructions（client 可能截斷或不顯示）。
		Description: "Create or partially update one of the author's writing memories. MCP writes are active immediately with no review step, " +
			"so only call this after the author has explicitly agreed in the conversation to the exact content and scope. " +
			"Search first and pass memory_public_id to update an existing memory instead of duplicating it; only supplied fields change, " +
			"and the ID must already exist in the requested context. Omit memory_public_id to create; scope_type, kind and content are then required. " +
			"project_public_id is always required for authorization. " +
			"kind: preference = style/taste, instruction = standing rule, decision = settled plot/setting choice, context = background fact.",
		InputSchema: objectSchema(map[string]interface{}{
			"memory_public_id":  stringSchema("Optional stable memory public_id. Omit to create a new memory."),
			"project_public_id": stringSchema("Project public_id used to authorize and resolve project/story/lore scope."),
			"story_public_id":   stringSchema("Required only for story scope."),
			"lore_public_id":    stringSchema("Required only for lore scope."),
			"memory_name":       stringSchema("Optional display name, at most 255 characters. On update, omit to preserve or pass an empty string to clear."),
			"scope_type":        enumStringSchema("Required on create; optional on update.", "project", "story", "lore"),
			"kind":              enumStringSchema("Required on create; optional on update.", "preference", "instruction", "decision", "context"),
			"tags":              stringArraySchema("Optional editable retrieval tags; at most 8 items and 24 characters per item."),
			"content": stringSchema("Required on create; optional on update. One atomic, self-contained fact, at most 2000 characters, " +
				"written so another AI with no chat history can apply it (include a short before/after example for style corrections)."),
			"priority":  integerSchema("Optional retrieval priority from 0 to 100; defaults to 50 on create and is preserved when omitted on update."),
			"is_pinned": booleanSchema("Optional. Pinned memories cannot be superseded automatically; preserved when omitted on update."),
		}, []string{"project_public_id"}),
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
