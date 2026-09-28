package storyteller

import (
	"context"
	"errors"
	"strings"

	storytellerModel "faryne.dev/model/entity/storyteller"
	"faryne.dev/service/log"
	auditService "faryne.dev/service/storytelleraudit"
	"go.uber.org/zap"
)

func auditToolCall(ctx context.Context, toolName string, arguments map[string]interface{}, handler ToolHandlerFunc) (interface{}, error) {
	return auditToolCallWithLookup(ctx, toolName, arguments, handler, nil)
}

type toolAuditLookup interface {
	AuditProjectByPublicID(userID uint64, publicID string) (*storytellerModel.Project, error)
	ProjectBefore(userID uint64, publicID string) (any, error)
	Story(projectID uint64, publicID string) (*storytellerModel.Story, error)
}

type defaultToolAuditLookup struct{ service *Service }

func (l defaultToolAuditLookup) AuditProjectByPublicID(userID uint64, publicID string) (*storytellerModel.Project, error) {
	return l.service.repo.AuditProjectByPublicID(userID, publicID)
}

func (l defaultToolAuditLookup) ProjectBefore(userID uint64, publicID string) (any, error) {
	return l.service.Project(userID, publicID)
}

func (l defaultToolAuditLookup) Story(projectID uint64, publicID string) (*storytellerModel.Story, error) {
	return l.service.repo.Story(projectID, publicID)
}

type toolAuditBeforeState struct {
	projectID     *uint64
	projectBefore any
	storyBefore   *storytellerModel.Story
}

func auditToolCallWithLookup(ctx context.Context, toolName string, arguments map[string]interface{}, handler ToolHandlerFunc, lookup toolAuditLookup) (interface{}, error) {
	// AI 助理也共用同一份 registry；只有外部 PAT 呼叫才在這層記 read/write event。
	if !auditService.IsPAT(ctx) {
		return handler(ctx, arguments)
	}
	action, mapped := storytellerModel.AuditActionForTool(toolName)
	if !mapped {
		return handler(ctx, arguments)
	}
	if lookup == nil {
		lookup = defaultToolAuditLookup{service: NewService()}
	}
	userID, err := storytellerUserIDFromContext(ctx)
	if err != nil {
		return nil, err
	}
	projectPublicID, _ := arguments["project_public_id"].(string)
	before := loadToolAuditBefore(lookup, userID, projectPublicID, toolName, action.Name, arguments)
	result, err := handler(ctx, arguments)
	if err != nil {
		actionName := resolvedToolAction(toolName, action.Name, arguments, before.projectBefore, nil)
		outcome := auditToolErrorOutcome(err)
		targetType, targetPublicID := auditToolTarget(actionName, arguments, nil)
		emitToolAudit(ctx, toolName, auditService.EventInput{
			Action: actionName, Outcome: outcome, ProjectID: before.projectID, TargetType: targetType,
			TargetPublicID: targetPublicID, Summary: auditService.ToolFailureSummary(outcome),
		})
		return result, err
	}
	actionName := resolvedToolAction(toolName, action.Name, arguments, before.projectBefore, result)
	actionName = resolvedToolStoryAction(toolName, actionName, arguments, before.storyBefore, result)
	if before.projectID == nil && actionName == "project.create" {
		if publicID := resultPublicID(result); publicID != "" {
			if project, lookupErr := lookup.AuditProjectByPublicID(userID, publicID); lookupErr == nil {
				before.projectID = &project.ID
			}
		}
	}
	summary := auditService.SafeSummary(arguments, result)
	if (actionName == "project.update" || actionName == "project.visibility.change") && before.projectBefore != nil {
		if diff := auditService.ProjectDiff(before.projectBefore, result); diff != nil {
			summary = diff
		}
	}
	targetType, targetPublicID := auditToolTarget(actionName, arguments, result)
	emitToolAudit(ctx, toolName, auditService.EventInput{
		Action: actionName, ProjectID: before.projectID, TargetType: targetType, TargetPublicID: targetPublicID, Summary: summary,
	})
	return result, nil
}

func emitToolAudit(ctx context.Context, toolName string, input auditService.EventInput) {
	if emitErr := auditService.Emit(ctx, input); emitErr != nil {
		log.Logger().Error("Emit storyteller MCP audit event failed", zap.String("tool", toolName), zap.Error(emitErr))
	}
}

func auditToolErrorOutcome(err error) storytellerModel.AuditOutcome {
	if errors.Is(err, errStorytellerMCPUnauthenticated) || errors.Is(err, ErrAgentToolScopeViolation) {
		return storytellerModel.AuditOutcomeDenied
	}
	return storytellerModel.AuditOutcomeFailed
}

func loadToolAuditBefore(lookup toolAuditLookup, userID uint64, projectPublicID, toolName, defaultAction string, arguments map[string]interface{}) toolAuditBeforeState {
	var state toolAuditBeforeState
	if projectPublicID == "" {
		return state
	}
	project, err := lookup.AuditProjectByPublicID(userID, projectPublicID)
	if err != nil {
		return state
	}
	state.projectID = &project.ID
	if toolName == "storyteller_patch_project" {
		state.projectBefore, _ = lookup.ProjectBefore(userID, projectPublicID)
	}
	actionName := resolvedToolAction(toolName, defaultAction, arguments, nil, nil)
	if targetPublicID := toolStoryPublicID(arguments); targetPublicID != "" && needsToolStoryBefore(actionName) {
		state.storyBefore, _ = lookup.Story(project.ID, targetPublicID)
	}
	return state
}

func needsToolStoryBefore(actionName string) bool {
	return actionName == "story.update" || actionName == "volume.update" || actionName == "story.delete"
}

func toolStoryPublicID(arguments map[string]interface{}) string {
	for _, key := range []string{"story_public_id", "volume_public_id"} {
		if value, _ := arguments[key].(string); value != "" {
			return value
		}
	}
	return ""
}

func resolvedToolStoryAction(toolName, action string, arguments map[string]interface{}, before *storytellerModel.Story, after any) string {
	if before == nil {
		return action
	}
	if action == "story.delete" && before.IsVolume {
		return "volume.delete"
	}
	changes := auditService.ChangedFields(before, after, "sort", "title", "summary", "status", "latest_version_id")
	if action == "story.update" {
		_, hasVolume := arguments["volume_public_id"]
		_, hasParent := arguments["parent_id"]
		if toolName != "storyteller_upsert_image_story" && (hasVolume || hasParent) {
			return "story.move"
		}
		if len(changes) == 2 {
			if _, sortChanged := changes["sort"]; sortChanged {
				if _, versionChanged := changes["latest_version_id"]; versionChanged {
					return "story.reorder"
				}
			}
		}
	}
	if action == "volume.update" && len(changes) == 2 {
		if _, sortChanged := changes["sort"]; sortChanged {
			if _, versionChanged := changes["latest_version_id"]; versionChanged {
				return "volume.reorder"
			}
		}
	}
	return action
}

func resolvedToolAction(toolName, defaultAction string, arguments map[string]interface{}, before, after any) string {
	switch toolName {
	case "storyteller_upsert_story", "storyteller_upsert_image_story":
		if value, _ := arguments["story_public_id"].(string); strings.TrimSpace(value) == "" {
			return "story.create"
		}
		return "story.update"
	case "storyteller_upsert_lore":
		if value, _ := arguments["lore_public_id"].(string); strings.TrimSpace(value) == "" {
			return "lore.create"
		}
		return "lore.update"
	case "storyteller_upsert_memory":
		if value, _ := arguments["memory_public_id"].(string); strings.TrimSpace(value) == "" {
			return "memory.create"
		}
		return "memory.update"
	case "storyteller_patch_project":
		if before == nil {
			return defaultAction
		}
		if after == nil {
			if _, changesVisibility := arguments["visibility"]; changesVisibility {
				return "project.visibility.change"
			}
			return defaultAction
		}
		diff := auditService.ProjectDiff(before, after)
		if changes, ok := diff["changes"].(map[string]any); ok {
			if _, changed := changes["visibility"]; changed {
				return "project.visibility.change"
			}
		}
	}
	return defaultAction
}

func auditToolTarget(action string, arguments map[string]interface{}, result any) (string, string) {
	var targetType, key string
	switch {
	case strings.HasPrefix(action, "project."):
		targetType, key = "project", "project_public_id"
	case strings.HasPrefix(action, "story_chapter."):
		targetType, key = "story", "story_public_id"
	case strings.HasPrefix(action, "story."):
		targetType, key = "story", "story_public_id"
	case strings.HasPrefix(action, "volume."):
		targetType, key = "volume", "volume_public_id"
	case strings.HasPrefix(action, "lore_collection."):
		targetType, key = "lore_collection", "collection_public_id"
	case strings.HasPrefix(action, "lore_chapter."):
		targetType, key = "lore", "lore_public_id"
	case strings.HasPrefix(action, "lore."):
		targetType, key = "lore", "lore_public_id"
	case strings.HasPrefix(action, "asset_collection."):
		targetType, key = "asset_collection", "collection_public_id"
	case strings.HasPrefix(action, "asset."):
		targetType, key = "asset", "asset_public_id"
	case strings.HasPrefix(action, "memory."):
		targetType, key = "memory", "memory_public_id"
	case strings.HasPrefix(action, "author_profile."):
		targetType, key = "author_profile", "pen_name"
	}
	publicID, _ := arguments[key].(string)
	if publicID == "" {
		publicID = resultPublicID(result)
	}
	return targetType, publicID
}

func resultPublicID(result any) string {
	value, _ := auditService.SafeSummary(nil, result)["public_id"].(string)
	return value
}
