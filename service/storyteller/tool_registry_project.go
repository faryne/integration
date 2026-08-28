package storyteller

import (
	"context"
	"fmt"
)

type storytellerProjectArguments struct {
	ProjectPublicID string `json:"project_public_id"`
}

func storytellerProjectToolSpecs() []ToolSpec {
	return []ToolSpec{
		ToolSpec{
			Name:        "storyteller_list_projects",
			Description: "List the authenticated user's storyteller writing projects.",
			InputSchema: objectSchema(nil, nil),
			Handler: func(ctx context.Context, arguments map[string]interface{}) (interface{}, error) {
				userID, err := storytellerUserIDFromContext(ctx)
				if err != nil {
					return nil, err
				}
				projects, err := NewService().Projects(userID)
				if err != nil {
					return nil, err
				}
				summaries := make([]storytellerProjectSummary, 0, len(projects))
				for _, project := range projects {
					summaries = append(summaries, toStorytellerProjectSummary(project))
				}
				return summaries, nil
			},
		},

		ToolSpec{
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
			Handler: func(ctx context.Context, arguments map[string]interface{}) (interface{}, error) {
				userID, err := storytellerUserIDFromContext(ctx)
				if err != nil {
					return nil, err
				}
				var args storytellerProjectArguments
				if err := decodeArguments(arguments, &args); err != nil {
					return nil, err
				}
				service := NewService()
				project, err := service.Project(userID, args.ProjectPublicID)
				if err != nil {
					return nil, err
				}
				stories, storyCount, err := service.StoriesPage(userID, args.ProjectPublicID, 1, storytellerProjectDetailListCap)
				if err != nil {
					return nil, err
				}
				lores, loreCount, err := service.LoresPage(userID, args.ProjectPublicID, "", 1, storytellerProjectDetailListCap)
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
				return storytellerProjectDetail{
					storytellerProjectSummary: toStorytellerProjectSummary(*project),
					Stories:                   storySummaries,
					StoryCount:                storyCount,
					Lores:                     loreSummaries,
					LoreCount:                 loreCount,
				}, nil
			},
		},
	}
}
