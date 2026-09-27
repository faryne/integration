package storyteller

import (
	"context"
	"strings"

	storytellerModel "faryne.dev/model/entity/storyteller"
	auditService "faryne.dev/service/storytelleraudit"
)

func (s *Service) ConfirmAssistantMemory(userID uint64, publicID string, in storytellerModel.AssistantMemoryConfirmRequest) (*storytellerModel.AssistantMemoryOutput, error) {
	row, err := s.repo.AssistantMemoryByPublicIDForUser(userID, strings.TrimSpace(publicID))
	if err != nil {
		return nil, err
	}
	if row.Status != storytellerModel.AssistantMemoryStatusCompleted {
		return nil, ErrAssistantMemoryDraftNotReady
	}
	if row.ShouldRemember == nil || !*row.ShouldRemember {
		return nil, ErrAssistantMemoryDraftEmpty
	}
	if row.SourceChatID == nil {
		return nil, ErrAssistantMemoryScopeInvalid
	}
	target, err := s.repo.AgentChatTarget(userID, *row.SourceChatID)
	if err != nil {
		return nil, err
	}
	project, err := s.repo.ProjectByPublicIDForUser(userID, target.ProjectPublicID)
	if err != nil {
		return nil, err
	}
	currentScope, story, lore, err := assistantMemoryGenerationTarget(s.repo, project.ID, target)
	if err != nil {
		return nil, err
	}
	if !assistantMemoryScopeAllowed(in.ScopeType, currentScope) {
		return nil, ErrAssistantMemoryScopeInvalid
	}
	if !assistantMemoryKindAllowed(in.Kind) {
		return nil, ErrAssistantMemoryKindInvalid
	}
	tags, err := normalizeAssistantMemoryTags(in.Tags)
	if err != nil {
		return nil, err
	}
	name, content := strings.TrimSpace(in.MemoryName), strings.TrimSpace(in.Content)
	if len([]rune(name)) > assistantMemoryNameMaxRunes {
		return nil, ErrAssistantMemoryNameTooLong
	}
	if len([]rune(content)) == 0 || len([]rune(content)) > assistantMemoryContentMaxRunes {
		return nil, ErrAssistantMemoryContentInvalid
	}
	if in.Priority > 100 {
		return nil, ErrAssistantMemoryPriorityInvalid
	}
	row.MemoryName, row.Content, row.ScopeType, row.Kind, row.Tags, row.Priority, row.IsPinned = nil, content, in.ScopeType, in.Kind, encodeAssistantMemoryTags(tags), in.Priority, in.IsPinned
	if name != "" {
		row.MemoryName = &name
	}
	row.ProjectID, row.StoryID, row.LoreID = nil, nil, nil
	switch in.ScopeType {
	case storytellerModel.AssistantMemoryScopeProject:
		row.ProjectID = &project.ID
	case storytellerModel.AssistantMemoryScopeStory:
		row.StoryID = &story.ID
	case storytellerModel.AssistantMemoryScopeLore:
		row.LoreID = &lore.ID
	}
	if in.SkipSupersede {
		row.SupersedesPublicID = nil
	}
	if row.SupersedesPublicID == nil {
		if err := s.rejectDuplicateAssistantMemory(userID, project, story, lore, row); err != nil {
			return nil, err
		}
	}
	affected, err := s.repo.ConfirmAssistantMemory(row)
	if err != nil {
		return nil, err
	}
	if affected == 0 {
		return nil, ErrAssistantMemoryDraftResolved
	}
	targetPublicID := ""
	if in.ScopeType == storytellerModel.AssistantMemoryScopeProject {
		targetPublicID = project.PublicID
	} else if in.ScopeType == storytellerModel.AssistantMemoryScopeStory {
		targetPublicID = story.PublicID
	} else if in.ScopeType == storytellerModel.AssistantMemoryScopeLore {
		targetPublicID = lore.PublicID
	}
	return &storytellerModel.AssistantMemoryOutput{PublicID: row.PublicID, MemoryName: name, ScopeType: in.ScopeType, TargetPublicID: targetPublicID, Kind: in.Kind, Tags: tags, Content: content, Priority: in.Priority, IsPinned: in.IsPinned, CreatedAt: row.CreatedAt, UpdatedAt: row.UpdatedAt}, nil
}

// RetryAssistantMemory 重新整理失敗草稿；新草稿建立成功後才丟棄舊資料。
func (s *Service) RetryAssistantMemory(ctx context.Context, userID uint64, publicID string, in storytellerModel.AssistantMemoryGenerateRequest) (*storytellerModel.AssistantMemoryDraftOutput, error) {
	row, err := s.repo.AssistantMemoryByPublicIDForUser(userID, strings.TrimSpace(publicID))
	if err != nil {
		return nil, err
	}
	if row.Status != storytellerModel.AssistantMemoryStatusFailed || row.SourceChatID == nil {
		return nil, ErrAssistantMemoryDraftNotReady
	}
	deps := s.assistantMemoryGenerationDeps()
	deps.AuditAction = "memory.draft.retry"
	deps.AuditContext, _ = auditService.RequestContextFrom(ctx)
	next, err := generateAssistantMemory(deps, userID, *row.SourceChatID, in)
	if err != nil {
		return nil, err
	}
	_, _ = s.repo.DeleteAssistantMemoryDraft(userID, row.ID)
	return next, nil
}

func (s *Service) DeleteAssistantMemoryDraft(userID uint64, publicID string) error {
	row, err := s.repo.AssistantMemoryByPublicIDForUser(userID, strings.TrimSpace(publicID))
	if err != nil {
		return err
	}
	affected, err := s.repo.DeleteAssistantMemoryDraft(userID, row.ID)
	if err != nil {
		return err
	}
	if affected == 0 {
		return ErrAssistantMemoryDraftResolved
	}
	return nil
}
