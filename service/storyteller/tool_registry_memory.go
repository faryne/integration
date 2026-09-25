package storyteller

import "context"

type storytellerListMemoriesArguments struct {
	ProjectPublicID string `json:"project_public_id"`
	StoryPublicID   string `json:"story_public_id"`
	LorePublicID    string `json:"lore_public_id"`
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
	}
}
