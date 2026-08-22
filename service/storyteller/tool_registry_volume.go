package storyteller

import (
	"context"

	storytellerModel "faryne.dev/model/entity/storyteller"
)

type storytellerVolumeArguments struct {
	ProjectPublicID string `json:"project_public_id"`
	VolumePublicID  string `json:"volume_public_id"`
}

type storytellerUpsertVolumeArguments struct {
	ProjectPublicID string `json:"project_public_id"`
	VolumePublicID  string `json:"volume_public_id"`
	Title           string `json:"title"`
	Summary         string `json:"summary"`
	Status          string `json:"status"`
	Sort            int    `json:"sort"`
	ContentType     string `json:"content_type"`
}

func storytellerVolumeToolSpecs() []ToolSpec {
	return []ToolSpec{
		ToolSpec{
			Name:        "storyteller_list_volumes",
			Description: "List volumes (\"冊\", top-level groupings of stories) belonging to a storyteller project.",
			InputSchema: objectSchema(map[string]interface{}{
				"project_public_id": stringSchema("Project public_id."),
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
				volumes, err := NewService().Volumes(userID, args.ProjectPublicID)
				if err != nil {
					return nil, err
				}
				return volumes, nil
			},
		},

		ToolSpec{
			Name: "storyteller_create_volume",
			Description: "Create a volume (\"冊\", a top-level grouping of stories) inside a storyteller project. " +
				"A volume only has a title/summary/status — no content of its own, and volumes cannot be nested inside " +
				"other volumes. Move stories into it afterwards via storyteller_upsert_story's parent handling in the web " +
				"editor, or by re-saving the story with its parent set through the same collection mechanics as lore/assets.",
			InputSchema: objectSchema(map[string]interface{}{
				"project_public_id": stringSchema("Project public_id."),
				"title":             stringSchema("Volume title, required."),
				"summary":           stringSchema("Short summary shown in listings."),
				"status":            stringSchema("draft or completed, defaults to completed. When draft, every story inside is hidden from readers regardless of its own status."),
				"sort":              integerSchema("Display order among the project's volumes."),
				"content_type":      stringSchema("text or image, defaults to text. Only used on create — determines whether stories placed in this volume are prose or image pages. Cannot be changed afterwards."),
			}, []string{"project_public_id", "title"}),
			Handler: func(ctx context.Context, arguments map[string]interface{}) (interface{}, error) {
				userID, err := storytellerUserIDFromContext(ctx)
				if err != nil {
					return nil, err
				}
				var args storytellerUpsertVolumeArguments
				if err := decodeArguments(arguments, &args); err != nil {
					return nil, err
				}
				input := storytellerModel.StoryVolumeRequest{
					Title:       args.Title,
					Summary:     args.Summary,
					Status:      storytellerModel.StoryStatus(args.Status),
					Sort:        args.Sort,
					ContentType: storytellerModel.ProjectContentType(args.ContentType),
				}
				source := storytellerSourceFromContext(ctx)
				volume, err := NewService().CreateVolume(userID, args.ProjectPublicID, input, source)
				if err != nil {
					return nil, err
				}
				return volume, nil
			},
		},

		ToolSpec{
			Name: "storyteller_update_volume",
			Description: "Rename a volume (\"冊\"), update its summary, display order, or draft/completed status. " +
				"content_type cannot be changed after creation and is ignored here.",
			InputSchema: objectSchema(map[string]interface{}{
				"project_public_id": stringSchema("Project public_id."),
				"volume_public_id":  stringSchema("Volume public_id."),
				"title":             stringSchema("Volume title, required."),
				"summary":           stringSchema("Short summary shown in listings."),
				"status":            stringSchema("draft or completed, defaults to completed. When draft, every story inside is hidden from readers regardless of its own status."),
				"sort":              integerSchema("Display order among the project's volumes."),
			}, []string{"project_public_id", "volume_public_id", "title"}),
			Handler: func(ctx context.Context, arguments map[string]interface{}) (interface{}, error) {
				userID, err := storytellerUserIDFromContext(ctx)
				if err != nil {
					return nil, err
				}
				var args storytellerUpsertVolumeArguments
				if err := decodeArguments(arguments, &args); err != nil {
					return nil, err
				}
				input := storytellerModel.StoryVolumeRequest{
					Title:   args.Title,
					Summary: args.Summary,
					Status:  storytellerModel.StoryStatus(args.Status),
					Sort:    args.Sort,
				}
				source := storytellerSourceFromContext(ctx)
				volume, err := NewService().UpdateVolume(userID, args.ProjectPublicID, args.VolumePublicID, input, source)
				if err != nil {
					return nil, err
				}
				return volume, nil
			},
		},

		ToolSpec{
			Name:        "storyteller_delete_volume",
			Description: "Delete a volume (\"冊\"). Fails while the volume still contains stories — move or delete them first.",
			InputSchema: objectSchema(map[string]interface{}{
				"project_public_id": stringSchema("Project public_id."),
				"volume_public_id":  stringSchema("Volume public_id."),
			}, []string{"project_public_id", "volume_public_id"}),
			Handler: func(ctx context.Context, arguments map[string]interface{}) (interface{}, error) {
				userID, err := storytellerUserIDFromContext(ctx)
				if err != nil {
					return nil, err
				}
				var args storytellerVolumeArguments
				if err := decodeArguments(arguments, &args); err != nil {
					return nil, err
				}
				if err := NewService().DeleteVolume(userID, args.ProjectPublicID, args.VolumePublicID); err != nil {
					return nil, err
				}
				return "deleted", nil
			},
		},
	}
}
