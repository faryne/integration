package storyteller

import (
	"context"

	storytellerModel "faryne.dev/model/entity/storyteller"
)

type storytellerAssetArguments struct {
	ProjectPublicID string `json:"project_public_id"`
	AssetPublicID   string `json:"asset_public_id"`
}

type storytellerListAssetsArguments struct {
	ProjectPublicID string `json:"project_public_id"`
	CollectionID    string `json:"collection_id"`
	AssetType       string `json:"asset_type"`
	Keyword         string `json:"keyword"`
	Page            int    `json:"page"`
	PageSize        int    `json:"page_size"`
}

type storytellerPresignAssetUploadArguments struct {
	ProjectPublicID string                                    `json:"project_public_id"`
	Files           []storytellerModel.AssetUploadFileRequest `json:"files"`
}

type storytellerConfirmAssetUploadArguments struct {
	ProjectPublicID  string                         `json:"project_public_id"`
	Key              string                         `json:"key"`
	ContentType      string                         `json:"content_type"`
	CollectionID     string                         `json:"collection_id"`
	OriginalFilename string                         `json:"original_filename"`
	Title            string                         `json:"title"`
	AltText          string                         `json:"alt_text"`
	Description      string                         `json:"description"`
	Metadata         storytellerModel.AssetMetadata `json:"metadata"`
}

type storytellerUpdateAssetArguments struct {
	ProjectPublicID string                         `json:"project_public_id"`
	AssetPublicID   string                         `json:"asset_public_id"`
	Title           string                         `json:"title"`
	AltText         string                         `json:"alt_text"`
	Description     string                         `json:"description"`
	Metadata        storytellerModel.AssetMetadata `json:"metadata"`
}

type storytellerMoveAssetArguments struct {
	ProjectPublicID string `json:"project_public_id"`
	AssetPublicID   string `json:"asset_public_id"`
	CollectionID    string `json:"collection_id"`
}

type storytellerAssetCollectionArguments struct {
	ProjectPublicID    string `json:"project_public_id"`
	CollectionPublicID string `json:"collection_public_id"`
}

type storytellerUpsertAssetCollectionArguments struct {
	ProjectPublicID    string `json:"project_public_id"`
	CollectionPublicID string `json:"collection_public_id"`
	Name               string `json:"name"`
	Description        string `json:"description"`
	Sort               int    `json:"sort"`
}

func storytellerAssetToolSpecs() []ToolSpec {
	return []ToolSpec{
		ToolSpec{
			Name:        "storyteller_list_assets",
			Description: "List image assets belonging to a storyteller project. Assets are project-scoped and cannot be used across projects.",
			InputSchema: objectSchema(map[string]interface{}{
				"project_public_id": stringSchema("Project public_id."),
				"collection_id":     stringSchema("Optional asset collection public_id. Omit for all assets, or pass __uncategorized__ for uncategorized assets."),
				"asset_type":        stringSchema("Optional. Currently only image is supported."),
				"keyword":           stringSchema("Optional keyword matched against title, original filename, alt text, or description."),
				"page":              integerSchema("Page number, defaults to 1."),
				"page_size":         integerSchema("Page size, defaults to 24 and maxes at 100."),
			}, []string{"project_public_id"}),
			Handler: func(ctx context.Context, arguments map[string]interface{}) (interface{}, error) {
				userID, err := storytellerUserIDFromContext(ctx)
				if err != nil {
					return nil, err
				}
				var args storytellerListAssetsArguments
				if err := decodeArguments(arguments, &args); err != nil {
					return nil, err
				}
				page, err := NewService().Assets(userID, args.ProjectPublicID, args.CollectionID, args.AssetType, args.Keyword, args.Page, args.PageSize)
				if err != nil {
					return nil, err
				}
				return page, nil
			},
		},

		ToolSpec{
			Name:        "storyteller_get_asset",
			Description: "Get one project asset's metadata and a short-lived preview URL for the authenticated author.",
			InputSchema: objectSchema(map[string]interface{}{
				"project_public_id": stringSchema("Project public_id."),
				"asset_public_id":   stringSchema("Asset public_id."),
			}, []string{"project_public_id", "asset_public_id"}),
			Handler: func(ctx context.Context, arguments map[string]interface{}) (interface{}, error) {
				userID, err := storytellerUserIDFromContext(ctx)
				if err != nil {
					return nil, err
				}
				var args storytellerAssetArguments
				if err := decodeArguments(arguments, &args); err != nil {
					return nil, err
				}
				asset, err := NewService().Asset(userID, args.ProjectPublicID, args.AssetPublicID)
				if err != nil {
					return nil, err
				}
				return asset, nil
			},
		},

		ToolSpec{
			Name: "storyteller_presign_asset_upload",
			Description: "Get presigned S3 PUT URLs for image assets in a project. Upload each file bytes to its upload_url " +
				"with a Content-Type header matching the declared content_type, then call storyteller_confirm_asset_upload.",
			InputSchema: objectSchema(map[string]interface{}{
				"project_public_id": stringSchema("Project public_id."),
				"files": map[string]interface{}{
					"type":        "array",
					"description": "Files to upload. Each item needs content_type (image/jpeg, image/png, image/webp, image/gif) and may include original_filename.",
					"minItems":    1,
					"items": map[string]interface{}{
						"type": "object",
						"properties": map[string]interface{}{
							"content_type":      stringSchema("MIME type. Must be image/jpeg, image/png, image/webp, or image/gif."),
							"original_filename": stringSchema("Original filename for display."),
						},
						"required": []string{"content_type"},
					},
				},
			}, []string{"project_public_id", "files"}),
			Handler: func(ctx context.Context, arguments map[string]interface{}) (interface{}, error) {
				userID, err := storytellerUserIDFromContext(ctx)
				if err != nil {
					return nil, err
				}
				var args storytellerPresignAssetUploadArguments
				if err := decodeArguments(arguments, &args); err != nil {
					return nil, err
				}
				uploads, err := NewService().PresignAssetUpload(ctx, userID, args.ProjectPublicID, storytellerModel.AssetUploadRequest{Files: args.Files})
				if err != nil {
					return nil, err
				}
				return uploads, nil
			},
		},

		ToolSpec{
			Name:        "storyteller_confirm_asset_upload",
			Description: "Confirm a completed presigned asset upload and create the project asset row. Returns asset_public_id and metadata.",
			InputSchema: objectSchema(map[string]interface{}{
				"project_public_id": stringSchema("Project public_id."),
				"key":               stringSchema("S3 key returned by storyteller_presign_asset_upload."),
				"content_type":      stringSchema("MIME type declared during presign."),
				"collection_id":     stringSchema("Optional asset collection public_id. Omit to keep the asset uncategorized."),
				"original_filename": stringSchema("Original filename for display."),
				"title":             stringSchema("Optional asset title."),
				"alt_text":          stringSchema("Optional alt text."),
				"description":       stringSchema("Optional asset description."),
				"metadata":          objectSchema(nil, nil),
			}, []string{"project_public_id", "key", "content_type"}),
			Handler: func(ctx context.Context, arguments map[string]interface{}) (interface{}, error) {
				userID, err := storytellerUserIDFromContext(ctx)
				if err != nil {
					return nil, err
				}
				var args storytellerConfirmAssetUploadArguments
				if err := decodeArguments(arguments, &args); err != nil {
					return nil, err
				}
				asset, err := NewService().ConfirmAssetUpload(userID, args.ProjectPublicID, storytellerModel.AssetConfirmRequest{
					Key:              args.Key,
					ContentType:      args.ContentType,
					CollectionID:     args.CollectionID,
					OriginalFilename: args.OriginalFilename,
					Title:            args.Title,
					AltText:          args.AltText,
					Description:      args.Description,
					Metadata:         args.Metadata,
				})
				if err != nil {
					return nil, err
				}
				return asset, nil
			},
		},

		ToolSpec{
			Name:        "storyteller_update_asset",
			Description: "Update a project asset's title, alt text, description, and metadata.",
			InputSchema: objectSchema(map[string]interface{}{
				"project_public_id": stringSchema("Project public_id."),
				"asset_public_id":   stringSchema("Asset public_id."),
				"title":             stringSchema("Asset title."),
				"alt_text":          stringSchema("Alt text."),
				"description":       stringSchema("Description."),
				"metadata":          objectSchema(nil, nil),
			}, []string{"project_public_id", "asset_public_id"}),
			Handler: func(ctx context.Context, arguments map[string]interface{}) (interface{}, error) {
				userID, err := storytellerUserIDFromContext(ctx)
				if err != nil {
					return nil, err
				}
				var args storytellerUpdateAssetArguments
				if err := decodeArguments(arguments, &args); err != nil {
					return nil, err
				}
				asset, err := NewService().UpdateAsset(userID, args.ProjectPublicID, args.AssetPublicID, storytellerModel.AssetUpdateRequest{
					Title:       args.Title,
					AltText:     args.AltText,
					Description: args.Description,
					Metadata:    args.Metadata,
				})
				if err != nil {
					return nil, err
				}
				return asset, nil
			},
		},

		ToolSpec{
			Name:        "storyteller_move_asset",
			Description: "Move a project asset into an asset collection, or pass an empty collection_id to make it uncategorized.",
			InputSchema: objectSchema(map[string]interface{}{
				"project_public_id": stringSchema("Project public_id."),
				"asset_public_id":   stringSchema("Asset public_id."),
				"collection_id":     stringSchema("Target asset collection public_id. Empty string moves the asset back to uncategorized."),
			}, []string{"project_public_id", "asset_public_id"}),
			Handler: func(ctx context.Context, arguments map[string]interface{}) (interface{}, error) {
				userID, err := storytellerUserIDFromContext(ctx)
				if err != nil {
					return nil, err
				}
				var args storytellerMoveAssetArguments
				if err := decodeArguments(arguments, &args); err != nil {
					return nil, err
				}
				asset, err := NewService().MoveAsset(userID, args.ProjectPublicID, args.AssetPublicID, storytellerModel.AssetMoveRequest{CollectionID: args.CollectionID})
				if err != nil {
					return nil, err
				}
				return asset, nil
			},
		},

		ToolSpec{
			Name:        "storyteller_list_asset_collections",
			Description: "List asset collections belonging to a storyteller project, including asset counts.",
			InputSchema: objectSchema(map[string]interface{}{
				"project_public_id": stringSchema("Project public_id."),
			}, []string{"project_public_id"}),
			Handler: func(ctx context.Context, arguments map[string]interface{}) (interface{}, error) {
				userID, err := storytellerUserIDFromContext(ctx)
				if err != nil {
					return nil, err
				}
				var args storytellerAssetCollectionArguments
				if err := decodeArguments(arguments, &args); err != nil {
					return nil, err
				}
				collections, err := NewService().AssetCollections(userID, args.ProjectPublicID)
				if err != nil {
					return nil, err
				}
				return collections, nil
			},
		},

		ToolSpec{
			Name:        "storyteller_create_asset_collection",
			Description: "Create an asset collection inside a storyteller project.",
			InputSchema: objectSchema(map[string]interface{}{
				"project_public_id": stringSchema("Project public_id."),
				"name":              stringSchema("Collection name."),
				"description":       stringSchema("Optional note describing what this asset collection is for."),
				"sort":              integerSchema("Display order among asset collections."),
			}, []string{"project_public_id", "name"}),
			Handler: func(ctx context.Context, arguments map[string]interface{}) (interface{}, error) {
				userID, err := storytellerUserIDFromContext(ctx)
				if err != nil {
					return nil, err
				}
				var args storytellerUpsertAssetCollectionArguments
				if err := decodeArguments(arguments, &args); err != nil {
					return nil, err
				}
				collection, err := NewService().CreateAssetCollection(userID, args.ProjectPublicID, storytellerModel.AssetCollectionRequest{Name: args.Name, Description: args.Description, Sort: args.Sort})
				if err != nil {
					return nil, err
				}
				return collection, nil
			},
		},

		ToolSpec{
			Name:        "storyteller_update_asset_collection",
			Description: "Rename an asset collection or update its display order.",
			InputSchema: objectSchema(map[string]interface{}{
				"project_public_id":    stringSchema("Project public_id."),
				"collection_public_id": stringSchema("Asset collection public_id."),
				"name":                 stringSchema("Collection name."),
				"description":          stringSchema("Optional note describing what this asset collection is for."),
				"sort":                 integerSchema("Display order among asset collections."),
			}, []string{"project_public_id", "collection_public_id", "name"}),
			Handler: func(ctx context.Context, arguments map[string]interface{}) (interface{}, error) {
				userID, err := storytellerUserIDFromContext(ctx)
				if err != nil {
					return nil, err
				}
				var args storytellerUpsertAssetCollectionArguments
				if err := decodeArguments(arguments, &args); err != nil {
					return nil, err
				}
				collection, err := NewService().UpdateAssetCollection(userID, args.ProjectPublicID, args.CollectionPublicID, storytellerModel.AssetCollectionRequest{Name: args.Name, Description: args.Description, Sort: args.Sort})
				if err != nil {
					return nil, err
				}
				return collection, nil
			},
		},

		ToolSpec{
			Name:        "storyteller_delete_asset_collection",
			Description: "Soft-delete an empty asset collection. Fails while the collection still contains assets.",
			InputSchema: objectSchema(map[string]interface{}{
				"project_public_id":    stringSchema("Project public_id."),
				"collection_public_id": stringSchema("Asset collection public_id."),
			}, []string{"project_public_id", "collection_public_id"}),
			Handler: func(ctx context.Context, arguments map[string]interface{}) (interface{}, error) {
				userID, err := storytellerUserIDFromContext(ctx)
				if err != nil {
					return nil, err
				}
				var args storytellerAssetCollectionArguments
				if err := decodeArguments(arguments, &args); err != nil {
					return nil, err
				}
				if err := NewService().DeleteAssetCollection(userID, args.ProjectPublicID, args.CollectionPublicID); err != nil {
					return nil, err
				}
				return "deleted", nil
			},
		},

		ToolSpec{
			Name:        "storyteller_delete_asset",
			Description: "Soft-delete a project asset. Fails if the asset is still referenced by latest content.",
			InputSchema: objectSchema(map[string]interface{}{
				"project_public_id": stringSchema("Project public_id."),
				"asset_public_id":   stringSchema("Asset public_id."),
			}, []string{"project_public_id", "asset_public_id"}),
			Handler: func(ctx context.Context, arguments map[string]interface{}) (interface{}, error) {
				userID, err := storytellerUserIDFromContext(ctx)
				if err != nil {
					return nil, err
				}
				var args storytellerAssetArguments
				if err := decodeArguments(arguments, &args); err != nil {
					return nil, err
				}
				if err := NewService().DeleteAsset(userID, args.ProjectPublicID, args.AssetPublicID); err != nil {
					return nil, err
				}
				return "deleted", nil
			},
		},
	}
}
