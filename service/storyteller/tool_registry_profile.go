package storyteller

import (
	"context"
	"errors"
	"fmt"
	"strings"

	storytellerModel "faryne.dev/model/entity/storyteller"
	"faryne.dev/repository"
)

type storytellerProfileArguments struct {
	PenName    string             `json:"pen_name"`
	NewPenName *string            `json:"new_pen_name"`
	Bio        *string            `json:"bio"`
	AvatarURL  *string            `json:"avatar_url"`
	SNSLinks   *map[string]string `json:"sns_links"`
}

// storytellerProfileMCPOnlyToolSpecs 額外筆名的維護工具。筆名是帳號層級資源（沒有 project_public_id），
// 跟 create_project 一樣只給外部 MCP client 用；一律以 pen_name 識別，不對外暴露 id。
func storytellerProfileMCPOnlyToolSpecs() []ToolSpec {
	snsSchema := map[string]interface{}{
		"type":                 "object",
		"description":          "Optional SNS links as {type: url}, e.g. {\"x\": \"https://x.com/name\"}. Replaces the whole set when provided.",
		"additionalProperties": map[string]interface{}{"type": "string"},
	}
	return []ToolSpec{
		{
			Name: "storyteller_list_profiles",
			Description: "List the account's pen names: the account's own identity (\"self\", edited on the web profile page) and the extra pen names " +
				"created for attributing individual stories. Use these pen_name values in the `profiles` argument of storyteller_upsert_story / " +
				"storyteller_patch_story / storyteller_upsert_image_story.",
			InputSchema: objectSchema(map[string]interface{}{}, nil),
			Handler: func(ctx context.Context, arguments map[string]interface{}) (interface{}, error) {
				userID, err := storytellerUserIDFromContext(ctx)
				if err != nil {
					return nil, err
				}
				service := NewService()
				extras, err := service.AuthorProfiles(userID)
				if err != nil {
					return nil, err
				}
				result := map[string]interface{}{"profiles": profilesForMCP(extras), "max_profiles": FreeMaxProfiles}
				self, err := service.repo.UserProfile(userID)
				if err != nil && !repository.IsRecordNotFound(err) {
					return nil, err
				}
				if self != nil {
					result["self"] = map[string]interface{}{"pen_name": self.PenName}
				}
				return result, nil
			},
		},
		{
			Name: "storyteller_create_profile",
			Description: "Create an extra pen name. The pen_name must be globally unique (also across other authors' own pen names) and cannot contain " +
				"/ \\ ? # % or control characters. Free accounts can have a limited number of extra pen names (see storyteller_list_profiles).",
			InputSchema: objectSchema(map[string]interface{}{
				"pen_name":   stringSchema("The new pen name, required."),
				"bio":        stringSchema("Optional bio (Markdown) shown on the pen name's author page."),
				"avatar_url": stringSchema("Optional avatar URL. Omit to use the default identicon."),
				"sns_links":  snsSchema,
			}, []string{"pen_name"}),
			Handler: func(ctx context.Context, arguments map[string]interface{}) (interface{}, error) {
				userID, err := storytellerUserIDFromContext(ctx)
				if err != nil {
					return nil, err
				}
				var args storytellerProfileArguments
				if err := decodeArguments(arguments, &args); err != nil {
					return nil, err
				}
				input := storytellerModel.AuthorProfileRequest{PenName: args.PenName, UseDefaultAvatar: true}
				if args.Bio != nil {
					input.Bio = *args.Bio
				}
				if args.AvatarURL != nil && strings.TrimSpace(*args.AvatarURL) != "" {
					input.AvatarURL, input.UseDefaultAvatar = *args.AvatarURL, false
				}
				if args.SNSLinks != nil {
					input.SNSLinks = *args.SNSLinks
				}
				profile, err := NewService().CreateAuthorProfile(userID, input)
				if err != nil {
					return nil, err
				}
				return profileForMCP(*profile), nil
			},
		},
		{
			Name: "storyteller_update_profile",
			Description: "Update an extra pen name, identified by its current pen_name. Only provided fields change; renaming (new_pen_name) " +
				"refreshes the search index of every story attributed to it. The account's own identity cannot be edited here — use the web profile page.",
			InputSchema: objectSchema(map[string]interface{}{
				"pen_name":     stringSchema("Current pen name of the extra pen name to update, required."),
				"new_pen_name": stringSchema("Optional new pen name."),
				"bio":          stringSchema("Optional new bio; pass an empty string to clear it."),
				"avatar_url":   stringSchema("Optional new avatar URL; pass an empty string to go back to the default identicon."),
				"sns_links":    snsSchema,
			}, []string{"pen_name"}),
			Handler: func(ctx context.Context, arguments map[string]interface{}) (interface{}, error) {
				userID, err := storytellerUserIDFromContext(ctx)
				if err != nil {
					return nil, err
				}
				var args storytellerProfileArguments
				if err := decodeArguments(arguments, &args); err != nil {
					return nil, err
				}
				service := NewService()
				current, err := service.ownAuthorProfileByPenName(userID, args.PenName)
				if err != nil {
					return nil, err
				}
				// 以現有內容為底，只覆蓋有傳的欄位
				input := storytellerModel.AuthorProfileRequest{
					PenName: current.PenName, Bio: current.Bio, UseDefaultAvatar: current.UseDefaultAvatar,
					AvatarURL: current.AvatarURL, SNSLinks: current.SNSLinks,
				}
				if args.NewPenName != nil {
					input.PenName = *args.NewPenName
				}
				if args.Bio != nil {
					input.Bio = *args.Bio
				}
				if args.AvatarURL != nil {
					input.AvatarURL = *args.AvatarURL
					input.UseDefaultAvatar = strings.TrimSpace(*args.AvatarURL) == ""
				}
				if args.SNSLinks != nil {
					input.SNSLinks = *args.SNSLinks
				}
				profile, err := service.UpdateAuthorProfile(userID, current.ID, input)
				if err != nil {
					return nil, err
				}
				return profileForMCP(*profile), nil
			},
		},
		{
			Name: "storyteller_delete_profile",
			Description: "Delete an extra pen name, identified by pen_name. Refused while any story is still attributed to it — " +
				"re-attribute those stories first via the `profiles` argument. The pen name stays reserved and cannot be re-used by anyone afterwards.",
			InputSchema: objectSchema(map[string]interface{}{
				"pen_name": stringSchema("Pen name of the extra pen name to delete, required."),
			}, []string{"pen_name"}),
			Handler: func(ctx context.Context, arguments map[string]interface{}) (interface{}, error) {
				userID, err := storytellerUserIDFromContext(ctx)
				if err != nil {
					return nil, err
				}
				var args storytellerProfileArguments
				if err := decodeArguments(arguments, &args); err != nil {
					return nil, err
				}
				service := NewService()
				current, err := service.ownAuthorProfileByPenName(userID, args.PenName)
				if err != nil {
					return nil, err
				}
				if err := service.DeleteAuthorProfile(userID, current.ID); err != nil {
					return nil, err
				}
				return map[string]interface{}{"deleted": true, "pen_name": current.PenName}, nil
			},
		},
	}
}

// ownAuthorProfileByPenName 在自己的額外筆名裡依 pen_name 找；找不到（含帳號本人的 pen_name）一律回錯。
func (s *Service) ownAuthorProfileByPenName(userID uint64, penName string) (*storytellerModel.AuthorProfile, error) {
	penName = strings.TrimSpace(penName)
	if penName == "" {
		return nil, errors.New("pen_name is required")
	}
	rows, err := s.repo.AuthorProfilesByUserID(userID)
	if err != nil {
		return nil, err
	}
	for i := range rows {
		if rows[i].PenName == penName {
			return &rows[i], nil
		}
	}
	return nil, fmt.Errorf("找不到額外筆名「%s」（帳號本人的筆名請到網頁的我的檔案編輯）", penName)
}

// profileForMCP 不帶 id：MCP 端一律以 pen_name 識別筆名。
func profileForMCP(p storytellerModel.AuthorProfileOutput) map[string]interface{} {
	return map[string]interface{}{
		"pen_name": p.PenName, "bio": p.Bio, "avatar_url": p.AvatarURL, "sns_links": p.SNSLinks,
	}
}

func profilesForMCP(rows []storytellerModel.AuthorProfileOutput) []map[string]interface{} {
	out := make([]map[string]interface{}, 0, len(rows))
	for _, row := range rows {
		out = append(out, profileForMCP(row))
	}
	return out
}
