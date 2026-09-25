package storyteller

import (
	"errors"
	"regexp"
	"strings"
	"time"

	entityModel "faryne.dev/model/entity"
	storytellerModel "faryne.dev/model/entity/storyteller"
)

const assistantMemorySearchMaxRunes = 100

var (
	ErrAssistantMemoryDuplicate       = errors.New("an identical active memory already exists in this scope")
	ErrAssistantMemoryNotEditable     = errors.New("assistant memory is not editable")
	ErrAssistantMemoryPublicIDInvalid = errors.New("memory_public_id is invalid")
	ErrAssistantMemorySearchInvalid   = errors.New("memory search keyword must be between 1 and 100 characters")
	ErrAssistantMemoryUpdateEmpty     = errors.New("at least one memory field must be provided when updating")
)

var assistantMemoryPublicIDRegexp = regexp.MustCompile(`^[A-Za-z0-9._~-]{1,32}$`)

func (s *Service) SearchAssistantMemories(userID uint64, projectPublicID, storyPublicID, lorePublicID, keyword string, limit int) ([]storytellerModel.AssistantMemoryOutput, error) {
	keyword = strings.TrimSpace(keyword)
	if len([]rune(keyword)) == 0 || len([]rune(keyword)) > assistantMemorySearchMaxRunes {
		return nil, ErrAssistantMemorySearchInvalid
	}
	project, story, lore, err := resolveAssistantMemoryContext(s.repo, userID, projectPublicID, storyPublicID, lorePublicID)
	if err != nil {
		return nil, err
	}
	storyID, loreID := assistantMemoryTargetIDs(story, lore)
	rows, err := s.repo.SearchAssistantMemories(userID, project.ID, storyID, loreID, keyword, normalizeAssistantMemoryLimit(limit))
	if err != nil {
		return nil, err
	}
	return assistantMemoryOutputs(rows, project, story, lore), nil
}

func resolveAssistantMemoryContext(repo assistantMemoryRepository, userID uint64, projectPublicID, storyPublicID, lorePublicID string) (*storytellerModel.Project, *storytellerModel.Story, *storytellerModel.Lore, error) {
	storyPublicID, lorePublicID = strings.TrimSpace(storyPublicID), strings.TrimSpace(lorePublicID)
	if storyPublicID != "" && lorePublicID != "" {
		return nil, nil, nil, ErrAssistantMemoryTargetInvalid
	}
	project, err := repo.ProjectByPublicIDForUser(userID, strings.TrimSpace(projectPublicID))
	if err != nil {
		return nil, nil, nil, err
	}
	var story *storytellerModel.Story
	var lore *storytellerModel.Lore
	if storyPublicID != "" {
		story, err = repo.Story(project.ID, storyPublicID)
	} else if lorePublicID != "" {
		lore, err = repo.Lore(project.ID, lorePublicID)
	}
	return project, story, lore, err
}

func (s *Service) UpdateAssistantMemory(userID uint64, projectPublicID, storyPublicID, lorePublicID, memoryPublicID string, in storytellerModel.AssistantMemoryUpdateRequest) (*storytellerModel.AssistantMemoryOutput, error) {
	project, story, lore, err := resolveAssistantMemoryContext(s.repo, userID, projectPublicID, storyPublicID, lorePublicID)
	if err != nil {
		return nil, err
	}
	currentScope := storytellerModel.AssistantMemoryScopeStory
	if lore != nil {
		currentScope = storytellerModel.AssistantMemoryScopeLore
	}
	if story == nil && lore == nil || !assistantMemoryScopeAllowed(in.ScopeType, currentScope) {
		return nil, ErrAssistantMemoryScopeInvalid
	}
	row, err := s.repo.AssistantMemoryByPublicIDForUser(userID, strings.TrimSpace(memoryPublicID))
	if err != nil {
		return nil, err
	}
	if row.Status != storytellerModel.AssistantMemoryStatusConfirmed || !assistantMemoryBelongsToContext(row, project, story, lore) {
		return nil, ErrAssistantMemoryNotEditable
	}
	if err := applyAssistantMemoryInput(row, project, story, lore, in); err != nil {
		return nil, err
	}
	if err := s.rejectDuplicateAssistantMemory(userID, project, story, lore, row); err != nil {
		return nil, err
	}
	affected, err := s.repo.UpdateAssistantMemory(row)
	if err != nil {
		return nil, err
	}
	if affected == 0 {
		return nil, ErrAssistantMemoryNotEditable
	}
	return assistantMemoryOutput(*row, project, story, lore), nil
}

func applyAssistantMemoryInput(row *storytellerModel.AssistantMemory, project *storytellerModel.Project, story *storytellerModel.Story, lore *storytellerModel.Lore, in storytellerModel.AssistantMemoryUpdateRequest) error {
	name, content := strings.TrimSpace(in.MemoryName), strings.TrimSpace(in.Content)
	if len([]rune(name)) > assistantMemoryNameMaxRunes {
		return ErrAssistantMemoryNameTooLong
	}
	if len([]rune(content)) == 0 || len([]rune(content)) > assistantMemoryContentMaxRunes {
		return ErrAssistantMemoryContentInvalid
	}
	if !assistantMemoryKindAllowed(in.Kind) {
		return ErrAssistantMemoryKindInvalid
	}
	if in.Priority > 100 {
		return ErrAssistantMemoryPriorityInvalid
	}
	row.MemoryName, row.Content, row.ScopeType, row.Kind, row.Priority, row.IsPinned = nil, content, in.ScopeType, in.Kind, in.Priority, in.IsPinned
	if name != "" {
		row.MemoryName = &name
	}
	row.ProjectID, row.StoryID, row.LoreID = nil, nil, nil
	switch in.ScopeType {
	case storytellerModel.AssistantMemoryScopeAccount:
	case storytellerModel.AssistantMemoryScopeProject:
		row.ProjectID = &project.ID
	case storytellerModel.AssistantMemoryScopeStory:
		if story == nil {
			return ErrAssistantMemoryScopeInvalid
		}
		row.StoryID = &story.ID
	case storytellerModel.AssistantMemoryScopeLore:
		if lore == nil {
			return ErrAssistantMemoryScopeInvalid
		}
		row.LoreID = &lore.ID
	default:
		return ErrAssistantMemoryScopeInvalid
	}
	return nil
}

// assistantMemoryBelongsToContext 先驗證原記憶確實是這個 context 目前可見的有效資料，
// 再允許修改 scope；否則只知道 public_id 的呼叫端就能把別處的記憶搬進目前專案。
func assistantMemoryBelongsToContext(row *storytellerModel.AssistantMemory, project *storytellerModel.Project, story *storytellerModel.Story, lore *storytellerModel.Lore) bool {
	if row.SupersededByID != nil {
		return false
	}
	switch row.ScopeType {
	case storytellerModel.AssistantMemoryScopeAccount:
		return row.ProjectID == nil && row.StoryID == nil && row.LoreID == nil
	case storytellerModel.AssistantMemoryScopeProject:
		return project != nil && entityModel.NullableEqual(row.ProjectID, &project.ID) && row.StoryID == nil && row.LoreID == nil
	case storytellerModel.AssistantMemoryScopeStory:
		return story != nil && row.ProjectID == nil && entityModel.NullableEqual(row.StoryID, &story.ID) && row.LoreID == nil
	case storytellerModel.AssistantMemoryScopeLore:
		return lore != nil && row.ProjectID == nil && row.StoryID == nil && entityModel.NullableEqual(row.LoreID, &lore.ID)
	default:
		return false
	}
}

func (s *Service) rejectDuplicateAssistantMemory(userID uint64, project *storytellerModel.Project, story *storytellerModel.Story, lore *storytellerModel.Lore, candidate *storytellerModel.AssistantMemory) error {
	storyID, loreID := assistantMemoryTargetIDs(story, lore)
	rows, err := s.repo.ActiveAssistantMemories(userID, project.ID, storyID, loreID, assistantMemoryMaxLimit)
	if err != nil {
		return err
	}
	wanted := normalizeAssistantMemoryContent(candidate.Content)
	for _, row := range rows {
		if row.ID != candidate.ID && row.ScopeType == candidate.ScopeType && normalizeAssistantMemoryContent(row.Content) == wanted {
			return ErrAssistantMemoryDuplicate
		}
	}
	return nil
}

func normalizeAssistantMemoryContent(content string) string {
	return strings.ToLower(strings.Join(strings.Fields(content), " "))
}

func (s *Service) DeleteAssistantMemory(userID uint64, publicID string) error {
	row, err := s.repo.AssistantMemoryByPublicIDForUser(userID, strings.TrimSpace(publicID))
	if err != nil {
		return err
	}
	affected, err := s.repo.DeleteAssistantMemory(userID, row.ID)
	if err != nil {
		return err
	}
	if affected == 0 {
		return ErrAssistantMemoryNotEditable
	}
	return nil
}

func (s *Service) UpsertAssistantMemory(userID uint64, in storytellerModel.AssistantMemoryUpsertRequest) (*storytellerModel.AssistantMemoryOutput, error) {
	project, story, lore, err := resolveAssistantMemoryContext(s.repo, userID, in.ProjectPublicID, in.StoryPublicID, in.LorePublicID)
	if err != nil {
		return nil, err
	}
	publicID := strings.TrimSpace(in.MemoryPublicID)
	creating := publicID == ""
	row := &storytellerModel.AssistantMemory{UserID: userID, PublicID: publicID, Status: storytellerModel.AssistantMemoryStatusConfirmed, Priority: 50}
	if creating {
		row.PublicID = randomID()
	} else if !assistantMemoryPublicIDRegexp.MatchString(publicID) {
		return nil, ErrAssistantMemoryPublicIDInvalid
	} else {
		row, err = s.repo.AssistantMemoryByPublicIDForUser(userID, publicID)
		if err != nil {
			return nil, err
		}
	}
	if !creating && (row.Status != storytellerModel.AssistantMemoryStatusConfirmed || !assistantMemoryBelongsToContext(row, project, story, lore)) {
		return nil, ErrAssistantMemoryNotEditable
	}
	if err := applyAssistantMemoryPatch(row, project, story, lore, in, creating); err != nil {
		return nil, err
	}
	if err := s.rejectDuplicateAssistantMemory(userID, project, story, lore, row); err != nil {
		return nil, err
	}
	if creating {
		now := time.Now()
		row.ConfirmedAt = &now
		if err := s.repo.CreateConfirmedAssistantMemory(row); err != nil {
			return nil, err
		}
	} else if affected, err := s.repo.UpdateAssistantMemory(row); err != nil {
		return nil, err
	} else if affected == 0 {
		return nil, ErrAssistantMemoryNotEditable
	}
	return assistantMemoryOutput(*row, project, story, lore), nil
}

func applyAssistantMemoryPatch(row *storytellerModel.AssistantMemory, project *storytellerModel.Project, story *storytellerModel.Story, lore *storytellerModel.Lore, in storytellerModel.AssistantMemoryUpsertRequest, creating bool) error {
	if creating && in.ScopeType == nil {
		return ErrAssistantMemoryScopeInvalid
	}
	if creating && in.Kind == nil {
		return ErrAssistantMemoryKindInvalid
	}
	if creating && in.Content == nil {
		return ErrAssistantMemoryContentInvalid
	}
	if !creating && in.MemoryName == nil && in.ScopeType == nil && in.Kind == nil && in.Content == nil && in.Priority == nil && in.IsPinned == nil {
		return ErrAssistantMemoryUpdateEmpty
	}
	if in.MemoryName != nil {
		name := strings.TrimSpace(*in.MemoryName)
		if len([]rune(name)) > assistantMemoryNameMaxRunes {
			return ErrAssistantMemoryNameTooLong
		}
		row.MemoryName = nil
		if name != "" {
			row.MemoryName = &name
		}
	}
	if in.Content != nil {
		content := strings.TrimSpace(*in.Content)
		if len([]rune(content)) == 0 || len([]rune(content)) > assistantMemoryContentMaxRunes {
			return ErrAssistantMemoryContentInvalid
		}
		row.Content = content
	}
	if in.Kind != nil {
		if !assistantMemoryKindAllowed(*in.Kind) {
			return ErrAssistantMemoryKindInvalid
		}
		row.Kind = *in.Kind
	}
	if in.Priority != nil {
		if *in.Priority > 100 {
			return ErrAssistantMemoryPriorityInvalid
		}
		row.Priority = *in.Priority
	}
	if in.IsPinned != nil {
		row.IsPinned = *in.IsPinned
	}
	if in.ScopeType == nil {
		return nil
	}
	row.ScopeType = *in.ScopeType
	row.ProjectID, row.StoryID, row.LoreID = nil, nil, nil
	switch *in.ScopeType {
	case storytellerModel.AssistantMemoryScopeAccount:
	case storytellerModel.AssistantMemoryScopeProject:
		row.ProjectID = &project.ID
	case storytellerModel.AssistantMemoryScopeStory:
		if story == nil {
			return ErrAssistantMemoryScopeInvalid
		}
		row.StoryID = &story.ID
	case storytellerModel.AssistantMemoryScopeLore:
		if lore == nil {
			return ErrAssistantMemoryScopeInvalid
		}
		row.LoreID = &lore.ID
	default:
		return ErrAssistantMemoryScopeInvalid
	}
	return nil
}

func assistantMemoryOutputs(rows []storytellerModel.AssistantMemory, project *storytellerModel.Project, story *storytellerModel.Story, lore *storytellerModel.Lore) []storytellerModel.AssistantMemoryOutput {
	out := make([]storytellerModel.AssistantMemoryOutput, 0, len(rows))
	for _, row := range rows {
		out = append(out, *assistantMemoryOutput(row, project, story, lore))
	}
	return out
}

func assistantMemoryOutput(row storytellerModel.AssistantMemory, project *storytellerModel.Project, story *storytellerModel.Story, lore *storytellerModel.Lore) *storytellerModel.AssistantMemoryOutput {
	targetPublicID := ""
	switch row.ScopeType {
	case storytellerModel.AssistantMemoryScopeProject:
		targetPublicID = project.PublicID
	case storytellerModel.AssistantMemoryScopeStory:
		if story != nil {
			targetPublicID = story.PublicID
		}
	case storytellerModel.AssistantMemoryScopeLore:
		if lore != nil {
			targetPublicID = lore.PublicID
		}
	}
	return &storytellerModel.AssistantMemoryOutput{PublicID: row.PublicID, MemoryName: assistantMemoryName(row.MemoryName), ScopeType: row.ScopeType, TargetPublicID: targetPublicID, Kind: row.Kind, Content: row.Content, Priority: row.Priority, IsPinned: row.IsPinned, CreatedAt: row.CreatedAt, UpdatedAt: row.UpdatedAt}
}
