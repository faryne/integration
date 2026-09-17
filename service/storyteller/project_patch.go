package storyteller

import (
	"errors"
	"strings"

	storytellerModel "faryne.dev/model/entity/storyteller"
)

var errProjectPatchEmptySlug = errors.New("slug must not be empty")

// ProjectPatch 以 pointer 區分「未提供」與「明確清空」；尤其 Tags 的空 slice 代表
// 使用者要清空標籤，nil 才是保留原值。
type ProjectPatch struct {
	Name        *string
	Slug        *string
	Description *string
	Visibility  *storytellerModel.ProjectVisibility
	Rating      *storytellerModel.ProjectRating
	ContentType *storytellerModel.ProjectContentType
	Tags        *[]string
}

// PatchProject 將 partial input 合併到既有 ProjectRequest，再走 UpdateProject 的同一套
// 驗證、分享 token 與搜尋索引同步，避免 MCP 另有一套更新規則。
func (s *Service) PatchProject(userID uint64, publicID string, patch ProjectPatch) (*storytellerModel.ProjectOutput, error) {
	project, err := s.repo.ProjectByPublicIDForUser(userID, publicID)
	if err != nil {
		return nil, err
	}
	input, err := projectRequestWithPatch(*project, patch)
	if err != nil {
		return nil, err
	}
	return s.UpdateProject(userID, publicID, input)
}

func projectRequestWithPatch(project storytellerModel.Project, patch ProjectPatch) (storytellerModel.ProjectRequest, error) {
	input := storytellerModel.ProjectRequest{
		Name: project.Name, Slug: project.Slug, Description: project.Description, Visibility: project.Visibility,
		Rating: project.Rating, ContentType: project.ContentType, Tags: decodeProjectTags(project.Tags),
	}
	if patch.Name != nil {
		input.Name = *patch.Name
	}
	if patch.Slug != nil {
		if strings.TrimSpace(*patch.Slug) == "" {
			return storytellerModel.ProjectRequest{}, errProjectPatchEmptySlug
		}
		input.Slug = *patch.Slug
	}
	if patch.Description != nil {
		input.Description = *patch.Description
	}
	if patch.Visibility != nil {
		input.Visibility = *patch.Visibility
	}
	if patch.Rating != nil {
		input.Rating = *patch.Rating
	}
	if patch.ContentType != nil {
		input.ContentType = *patch.ContentType
	}
	if patch.Tags != nil {
		input.Tags = *patch.Tags
	}
	return input, nil
}
