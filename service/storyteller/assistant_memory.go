package storyteller

import (
	"errors"
	"strings"

	storytellerModel "faryne.dev/model/entity/storyteller"
)

const (
	assistantMemoryDefaultLimit = 50
	assistantMemoryMaxLimit     = 100
	assistantMemoryPromptLimit  = 30
)

var ErrAssistantMemoryTargetInvalid = errors.New("exactly zero or one of story_public_id and lore_public_id may be provided")

type assistantMemoryRepository interface {
	ProjectByPublicIDForUser(userID uint64, publicID string) (*storytellerModel.Project, error)
	Story(projectID uint64, publicID string) (*storytellerModel.Story, error)
	Lore(projectID uint64, publicID string) (*storytellerModel.Lore, error)
	ActiveAssistantMemories(userID, projectID uint64, storyID, loreID *uint64, limit int) ([]storytellerModel.AssistantMemory, error)
}

// AssistantMemories 回傳目前畫面真正適用的記憶：專案層，再加上指定的 story
// 或 lore。目標 public_id 一律先在專案內解析，避免跨專案讀到記憶。
func (s *Service) AssistantMemories(userID uint64, projectPublicID, storyPublicID, lorePublicID string, limit int) ([]storytellerModel.AssistantMemoryOutput, error) {
	return readAssistantMemories(s.repo, userID, projectPublicID, storyPublicID, lorePublicID, limit)
}

func readAssistantMemories(repo assistantMemoryRepository, userID uint64, projectPublicID, storyPublicID, lorePublicID string, limit int) ([]storytellerModel.AssistantMemoryOutput, error) {
	storyPublicID, lorePublicID = strings.TrimSpace(storyPublicID), strings.TrimSpace(lorePublicID)
	if storyPublicID != "" && lorePublicID != "" {
		return nil, ErrAssistantMemoryTargetInvalid
	}
	project, err := repo.ProjectByPublicIDForUser(userID, strings.TrimSpace(projectPublicID))
	if err != nil {
		return nil, err
	}

	var story *storytellerModel.Story
	var lore *storytellerModel.Lore
	if storyPublicID != "" {
		if story, err = repo.Story(project.ID, storyPublicID); err != nil {
			return nil, err
		}
	}
	if lorePublicID != "" {
		if lore, err = repo.Lore(project.ID, lorePublicID); err != nil {
			return nil, err
		}
	}
	storyID, loreID := assistantMemoryTargetIDs(story, lore)
	rows, err := repo.ActiveAssistantMemories(userID, project.ID, storyID, loreID, normalizeAssistantMemoryLimit(limit))
	if err != nil {
		return nil, err
	}

	return assistantMemoryOutputs(rows, project, story, lore), nil
}

func assistantMemoryName(name *string) string {
	if name == nil {
		return ""
	}
	return *name
}

func assistantMemoryTargetIDs(story *storytellerModel.Story, lore *storytellerModel.Lore) (storyID, loreID *uint64) {
	if story != nil {
		storyID = &story.ID
	}
	if lore != nil {
		loreID = &lore.ID
	}
	return storyID, loreID
}

func normalizeAssistantMemoryLimit(limit int) int {
	if limit <= 0 {
		return assistantMemoryDefaultLimit
	}
	if limit > assistantMemoryMaxLimit {
		return assistantMemoryMaxLimit
	}
	return limit
}
