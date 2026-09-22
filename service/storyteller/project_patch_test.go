package storyteller

import (
	"testing"

	storytellerModel "faryne.dev/model/entity/storyteller"
	"github.com/stretchr/testify/require"
)

func TestProjectRequestWithPatchPreservesOmittedFields(t *testing.T) {
	project := storytellerModel.Project{
		Name: "原名稱", Slug: "original", Description: "原簡介", Visibility: storytellerModel.ProjectVisibilityPublic,
		Rating: storytellerModel.ProjectRatingGuidance, Tags: `["奇幻","機甲"]`,
	}
	description := "新簡介"

	input, err := projectRequestWithPatch(project, ProjectPatch{Description: &description})

	require.NoError(t, err)
	require.Equal(t, "原名稱", input.Name)
	require.Equal(t, "original", input.Slug)
	require.Equal(t, "新簡介", input.Description)
	require.Equal(t, storytellerModel.ProjectVisibilityPublic, input.Visibility)
	require.Equal(t, storytellerModel.ProjectRatingGuidance, input.Rating)
	require.Equal(t, []string{"奇幻", "機甲"}, input.Tags)
	require.Nil(t, input.CoverAssetPublicID)
	// CoverLayout／CoverFocalPoint 沒 patch 到時是 nil（＝不變更），不是回填專案現值——
	// 「不變更」的實際生效點在 UpdateProject，不是這裡。
	require.Nil(t, input.CoverLayout)
	require.Nil(t, input.CoverFocalPoint)
}

func TestProjectRequestWithPatchCanChangeCoverLayoutAndFocalPoint(t *testing.T) {
	project := storytellerModel.Project{Name: "作品", Slug: "work"}
	layout := storytellerModel.ProjectCoverLayoutImmersive
	focalPoint := storytellerModel.ProjectCoverFocalPoint{X: 0.7, Y: 0.2}

	input, err := projectRequestWithPatch(project, ProjectPatch{CoverLayout: &layout, CoverFocalPoint: &focalPoint})

	require.NoError(t, err)
	require.NotNil(t, input.CoverLayout)
	require.Equal(t, storytellerModel.ProjectCoverLayoutImmersive, *input.CoverLayout)
	require.NotNil(t, input.CoverFocalPoint)
	require.Equal(t, focalPoint, *input.CoverFocalPoint)
}

func TestProjectRequestWithPatchCanClearTags(t *testing.T) {
	project := storytellerModel.Project{Name: "作品", Slug: "work", Tags: `["奇幻"]`}
	emptyTags := []string{}

	input, err := projectRequestWithPatch(project, ProjectPatch{Tags: &emptyTags})

	require.NoError(t, err)
	require.Empty(t, input.Tags)
}

func TestProjectRequestWithPatchRejectsEmptySlug(t *testing.T) {
	project := storytellerModel.Project{Name: "作品", Slug: "work"}
	emptySlug := "  "

	_, err := projectRequestWithPatch(project, ProjectPatch{Slug: &emptySlug})

	require.ErrorIs(t, err, errProjectPatchEmptySlug)
}
