package storyteller

import (
	"context"
	"errors"
	"fmt"

	storytellerModel "faryne.dev/model/entity/storyteller"
)

type storytellerProjectArguments struct {
	ProjectPublicID string `json:"project_public_id"`
}

type storytellerCreateProjectArguments struct {
	Name        string                             `json:"name"`
	Description string                             `json:"description"`
	Visibility  storytellerModel.ProjectVisibility `json:"visibility"`
	Rating      storytellerModel.ProjectRating     `json:"rating"`
	Tags        []string                           `json:"tags"`
}

type storytellerPatchProjectArguments struct {
	ProjectPublicID    string                              `json:"project_public_id"`
	Name               *string                             `json:"name"`
	Slug               *string                             `json:"slug"`
	Description        *string                             `json:"description"`
	Visibility         *storytellerModel.ProjectVisibility `json:"visibility"`
	Rating             *storytellerModel.ProjectRating     `json:"rating"`
	Tags               *[]string                           `json:"tags"`
	CoverAssetPublicID *string                             `json:"cover_asset_public_id"`
}

var errStorytellerProjectPatchEmpty = errors.New("at least one project field must be provided")

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

		ToolSpec{
			Name: "storyteller_patch_project",
			Description: "Partially update a project's metadata. Only provided fields are changed; omitted fields keep their current values. " +
				"Passing tags as an empty array explicitly clears all tags. Changing slug or visibility can affect public URLs and sharing. " +
				"cover_asset_public_id sets the project cover to an existing image asset in the same project; pass an empty string to clear it.",
			InputSchema: objectSchema(map[string]interface{}{
				"project_public_id":     stringSchema("Project public_id."),
				"name":                  stringSchema("New project name. Omit to preserve the current name."),
				"slug":                  stringSchema("New non-empty URL slug. Omit to preserve the current slug."),
				"description":           stringSchema("New project description. Pass an empty string to clear it."),
				"visibility":            enumStringSchema("New visibility. Omit to preserve it.", "public", "unlisted", "private"),
				"rating":                enumStringSchema("New content rating. Omit to preserve it.", "general", "guidance", "restricted"),
				"tags":                  stringArraySchema("New tag list. Pass an empty array to clear all tags; omit to preserve them."),
				"cover_asset_public_id": stringSchema("Image asset public_id in this project to use as the cover. Pass an empty string to clear it; omit to leave the current cover unchanged."),
			}, []string{"project_public_id"}),
			Handler: func(ctx context.Context, arguments map[string]interface{}) (interface{}, error) {
				userID, err := storytellerUserIDFromContext(ctx)
				if err != nil {
					return nil, err
				}
				var args storytellerPatchProjectArguments
				if err := decodeArguments(arguments, &args); err != nil {
					return nil, err
				}
				if args.Name == nil && args.Slug == nil && args.Description == nil && args.Visibility == nil && args.Rating == nil && args.Tags == nil && args.CoverAssetPublicID == nil {
					return nil, errStorytellerProjectPatchEmpty
				}
				project, err := NewService().PatchProject(userID, args.ProjectPublicID, ProjectPatch{
					Name: args.Name, Slug: args.Slug, Description: args.Description, Visibility: args.Visibility,
					Rating: args.Rating, Tags: args.Tags, CoverAssetPublicID: args.CoverAssetPublicID,
				})
				if err != nil {
					return nil, err
				}
				return toStorytellerProjectSummary(*project), nil
			},
		},
	}
}

// storytellerProjectMCPOnlyToolSpecs 放置建立專案這類「執行前還沒有 project_public_id」
// 的工具；站內 Agent 的 scope／proposal 都綁在既有專案，不能把這類工具混進主 registry。
func storytellerProjectMCPOnlyToolSpecs() []ToolSpec {
	return []ToolSpec{
		{
			Name: "storyteller_create_project",
			Description: "Create a new storyteller writing project. Only name is required. Visibility defaults to private, " +
				"and rating to general. The URL slug is generated from the name and returned in the result.",
			InputSchema: objectSchema(map[string]interface{}{
				"name":        stringSchema("Project name, required."),
				"description": stringSchema("Optional project description."),
				"visibility":  enumStringSchema("public, unlisted, or private. Defaults to private.", "public", "unlisted", "private"),
				"rating":      enumStringSchema("general, guidance, or restricted. Defaults to general.", "general", "guidance", "restricted"),
				"tags":        stringArraySchema("Optional tags, at most 12 items and 24 characters per tag."),
			}, []string{"name"}),
			Handler: func(ctx context.Context, arguments map[string]interface{}) (interface{}, error) {
				userID, err := storytellerUserIDFromContext(ctx)
				if err != nil {
					return nil, err
				}
				var args storytellerCreateProjectArguments
				if err := decodeArguments(arguments, &args); err != nil {
					return nil, err
				}
				project, err := NewService().CreateProject(userID, storytellerModel.ProjectRequest{
					Name: args.Name, Description: args.Description, Visibility: args.Visibility,
					Rating: args.Rating, Tags: args.Tags,
				})
				if err != nil {
					return nil, err
				}
				return toStorytellerProjectSummary(*project), nil
			},
		},
	}
}
