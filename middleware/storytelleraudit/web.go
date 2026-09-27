package storytelleraudit

import (
	"encoding/json"
	"errors"
	"fmt"
	"strings"

	storytellerModel "faryne.dev/model/entity/storyteller"
	storytellerRepo "faryne.dev/repository/storyteller"
	"faryne.dev/service/log"
	"faryne.dev/service/output"
	storytellerService "faryne.dev/service/storyteller"
	auditService "faryne.dev/service/storytelleraudit"
	"github.com/gofiber/fiber/v3"
	"go.uber.org/zap"
)

// WebSuccess 統一處理 mapped route 的 success／denied／failed；async action 的成功事件
// 由背景工作完成時送出，這裡只處理同步 submit failure。
func WebSuccess() fiber.Handler {
	return webSuccess(defaultWebAuditLookup{repository: storytellerRepo.NewRepository()})
}

type webAuditLookup interface {
	AuditProjectByPublicID(userID uint64, publicID string) (*storytellerModel.Project, error)
	ProjectBefore(userID uint64, publicID string) (any, error)
	Story(projectID uint64, publicID string) (*storytellerModel.Story, error)
}

type defaultWebAuditLookup struct{ repository *storytellerRepo.Repository }

func (l defaultWebAuditLookup) AuditProjectByPublicID(userID uint64, publicID string) (*storytellerModel.Project, error) {
	return l.repository.AuditProjectByPublicID(userID, publicID)
}

func (defaultWebAuditLookup) ProjectBefore(userID uint64, publicID string) (any, error) {
	return storytellerService.NewService().Project(userID, publicID)
}

func (l defaultWebAuditLookup) Story(projectID uint64, publicID string) (*storytellerModel.Story, error) {
	return l.repository.Story(projectID, publicID)
}

type webAuditBeforeState struct {
	projectID     *uint64
	projectBefore any
	storyBefore   *storytellerModel.Story
}

func webSuccess(lookup webAuditLookup) fiber.Handler {
	return func(ctx fiber.Ctx) error {
		action, mapped := auditActionForRequest(ctx.Method(), ctx.Path())
		if !mapped {
			return ctx.Next()
		}
		requestContext, _ := Get(ctx)
		projectPublicID := projectPublicIDFromPath(ctx.Path())
		before := loadWebAuditBefore(lookup, requestContext.ActorUserID, projectPublicID, action.Name, storyPublicIDFromPath(ctx.Path()))
		err := ctx.Next()
		response, ok := err.(output.CommonOutputInterface)
		if !ok || response.HttpCode() < 200 || response.HttpCode() >= 300 {
			emitWebFailure(ctx, err, action.Name, before.projectID)
			return err
		}
		if isAsyncAuditAction(action.Name) {
			return err
		}
		data := response.Output(0, "").Data
		arguments := webAuditArguments(ctx)
		actionName := action.Name
		if actionName == "project.update" && before.projectBefore != nil {
			if changes, ok := auditService.ProjectDiff(before.projectBefore, data)["changes"].(map[string]any); ok {
				if _, changed := changes["visibility"]; changed {
					actionName = "project.visibility.change"
				}
			}
		}
		actionName = resolvedWebStoryAction(actionName, before.storyBefore, data)
		if before.projectID == nil {
			before.projectID = numericFieldPointer(data, "id")
		}
		summary := auditService.SafeSummary(arguments, data)
		if strings.HasPrefix(actionName, "pat.") || strings.HasPrefix(actionName, "provider_key.") {
			summary = auditService.CredentialSummary(arguments, data)
		}
		if (actionName == "project.update" || actionName == "project.visibility.change") && before.projectBefore != nil {
			summary = auditService.ProjectDiff(before.projectBefore, data)
		}
		targetType, targetPublicID := webAuditTarget(actionName, arguments, data)
		if emitErr := auditService.Emit(ctx.Context(), auditService.EventInput{
			Action: actionName, ProjectID: before.projectID, TargetType: targetType, TargetPublicID: targetPublicID, Summary: summary,
		}); emitErr != nil {
			log.Logger().Error("Emit storyteller Web audit event failed", zap.String("route", ctx.Method()+" "+ctx.Path()), zap.Error(emitErr))
		}
		return err
	}
}

func emitWebFailure(ctx fiber.Ctx, err error, actionName string, projectID *uint64) {
	status, customCode := fiber.StatusInternalServerError, ""
	if response, ok := err.(output.CommonOutputInterface); ok {
		status = response.HttpCode()
		customCode = string(response.Output(0, "").CustomCode)
	} else {
		var fiberErr *fiber.Error
		if errors.As(err, &fiberErr) {
			status = fiberErr.Code
		}
	}
	outcome := auditService.OutcomeForHTTPStatus(status)
	if actionName == "auth.login" {
		actionName, outcome = "auth.login.failed", storytellerModel.AuditOutcomeDenied
	}
	summary := auditService.FailureSummary(status, customCode)
	if actionName == "auth.login.failed" {
		summary["provider"] = "firebase"
	}
	arguments := webAuditPathArguments(ctx)
	targetType, targetPublicID := webAuditTarget(actionName, arguments, nil)
	if emitErr := auditService.Emit(ctx.Context(), auditService.EventInput{
		Action: actionName, Outcome: outcome, ProjectID: projectID, TargetType: targetType, TargetPublicID: targetPublicID, Summary: summary,
	}); emitErr != nil {
		log.Logger().Error("Emit failed storyteller Web audit event failed", zap.String("route", ctx.Method()+" "+ctx.Path()), zap.Error(emitErr))
	}
}

func isAsyncAuditAction(actionName string) bool {
	return actionName == "agent.run" || actionName == "agent.resend" || actionName == "memory.draft.generate" || actionName == "memory.draft.retry"
}

func loadWebAuditBefore(lookup webAuditLookup, userID uint64, projectPublicID, actionName, storyPublicID string) webAuditBeforeState {
	var state webAuditBeforeState
	if userID == 0 || projectPublicID == "" {
		return state
	}
	project, err := lookup.AuditProjectByPublicID(userID, projectPublicID)
	if err != nil {
		return state
	}
	state.projectID = &project.ID
	if actionName == "project.update" {
		state.projectBefore, _ = lookup.ProjectBefore(userID, projectPublicID)
	}
	if storyPublicID != "" && needsStoryBefore(actionName) {
		state.storyBefore, _ = lookup.Story(project.ID, storyPublicID)
	}
	return state
}

func needsStoryBefore(actionName string) bool {
	return actionName == "story.update" || actionName == "volume.update" || actionName == "story.delete"
}

func auditActionForRequest(method, path string) (storytellerModel.AuditActionDefinition, bool) {
	for _, action := range storytellerModel.StorytellerAuditActions {
		for _, route := range action.Routes {
			if strings.EqualFold(route.Method, method) && routeTemplateMatches(route.Path, path) {
				return action, true
			}
		}
	}
	return storytellerModel.AuditActionDefinition{}, false
}

func routeTemplateMatches(template, path string) bool {
	templateParts, pathParts := strings.Split(strings.Trim(template, "/"), "/"), strings.Split(strings.Trim(path, "/"), "/")
	if len(templateParts) != len(pathParts) {
		return false
	}
	for index := range templateParts {
		if !strings.HasPrefix(templateParts[index], ":") && templateParts[index] != pathParts[index] {
			return false
		}
	}
	return true
}

func storyPublicIDFromPath(path string) string {
	parts := strings.Split(strings.Trim(path, "/"), "/")
	for index := 0; index+1 < len(parts); index++ {
		if parts[index] == "stories" || parts[index] == "volumes" {
			return parts[index+1]
		}
	}
	return ""
}

func resolvedWebStoryAction(action string, before *storytellerModel.Story, after any) string {
	if before == nil {
		return action
	}
	if action == "story.delete" && before.IsVolume {
		return "volume.delete"
	}
	changes := auditService.ChangedFields(before, after, "parent_id", "sort", "title", "summary", "status", "latest_version_id")
	if action == "story.update" {
		if _, changed := changes["parent_id"]; changed {
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
	if action == "volume.update" {
		if len(changes) == 2 {
			if _, sortChanged := changes["sort"]; sortChanged {
				if _, versionChanged := changes["latest_version_id"]; versionChanged {
					return "volume.reorder"
				}
			}
		}
	}
	return action
}

func projectPublicIDFromPath(path string) string {
	parts := strings.Split(strings.Trim(path, "/"), "/")
	if len(parts) >= 3 && parts[0] == "storyteller" && (parts[1] == "projects" || parts[1] == "story") {
		return parts[2]
	}
	return ""
}

func webAuditArguments(ctx fiber.Ctx) map[string]any {
	arguments := map[string]any{}
	_ = json.Unmarshal(ctx.Body(), &arguments)
	for key, value := range webAuditPathArguments(ctx) {
		arguments[key] = value
	}
	return arguments
}

func webAuditPathArguments(ctx fiber.Ctx) map[string]any {
	arguments := map[string]any{}
	for param, key := range map[string]string{
		"project": "project_public_id", "story": "story_public_id", "volume": "volume_public_id",
		"lore": "lore_public_id", "asset": "asset_public_id", "collection": "collection_public_id", "version": "version_id",
		"profile": "profile_id", "apikey": "provider_key_id", "token": "token_id", "agent": "agent_id",
		"chat": "chat_id", "memory": "memory_public_id", "proposal": "proposal_public_id", "author": "author_public_id", "model": "model_id",
	} {
		if value := ctx.Params(param); value != "" {
			arguments[key] = value
		}
	}
	return arguments
}

func webAuditTarget(action string, arguments map[string]any, result any) (string, string) {
	var targetType, key string
	switch {
	case strings.HasPrefix(action, "project."):
		targetType, key = "project", "project_public_id"
	case strings.HasPrefix(action, "story."):
		targetType, key = "story", "story_public_id"
	case strings.HasPrefix(action, "volume."):
		targetType, key = "volume", "volume_public_id"
	case strings.HasPrefix(action, "lore_collection."):
		targetType, key = "lore_collection", "collection_public_id"
	case strings.HasPrefix(action, "lore."):
		targetType, key = "lore", "lore_public_id"
	case strings.HasPrefix(action, "asset_collection."):
		targetType, key = "asset_collection", "collection_public_id"
	case strings.HasPrefix(action, "asset."):
		targetType, key = "asset", "asset_public_id"
	case strings.HasPrefix(action, "pat."):
		targetType, key = "personal_access_token", "token_id"
	case strings.HasPrefix(action, "provider_key."):
		targetType, key = "provider_key", "provider_key_id"
	case strings.HasPrefix(action, "author_profile."):
		targetType, key = "author_profile", "profile_id"
	case strings.HasPrefix(action, "profile."):
		targetType = "profile"
	case strings.HasPrefix(action, "agent_skill."):
		targetType, key = "agent_skill", "agent_id"
	case strings.HasPrefix(action, "agent.proposal."):
		targetType, key = "agent_proposal", "proposal_public_id"
	case strings.HasPrefix(action, "agent."):
		targetType, key = "agent_chat", "chat_id"
	case strings.HasPrefix(action, "memory."):
		targetType, key = "memory", "memory_public_id"
	case strings.HasPrefix(action, "favorite."):
		if _, ok := arguments["author_public_id"]; ok {
			targetType, key = "favorite_author", "author_public_id"
		} else {
			targetType, key = "favorite_project", "project_public_id"
		}
	case strings.HasPrefix(action, "bookmark."):
		if _, ok := arguments["story_public_id"]; ok {
			targetType, key = "story_bookmark", "story_public_id"
		} else {
			targetType, key = "lore_bookmark", "lore_public_id"
		}
	case strings.HasPrefix(action, "ranking."):
		targetType, key = "project_ranking", "project_public_id"
	}
	publicID, _ := arguments[key].(string)
	if publicID == "" {
		for _, resultKey := range []string{"public_id", "id", "chat_id"} {
			publicID = stringField(result, resultKey)
			if publicID != "" {
				break
			}
		}
	}
	return targetType, publicID
}

func stringField(value any, key string) string {
	data, _ := json.Marshal(value)
	var object map[string]any
	if json.Unmarshal(data, &object) != nil {
		return ""
	}
	result := object[key]
	if result == nil {
		return ""
	}
	if value, ok := result.(string); ok {
		return value
	}
	return fmt.Sprint(result)
}

func numericFieldPointer(value any, key string) *uint64 {
	data, _ := json.Marshal(value)
	var object map[string]any
	if json.Unmarshal(data, &object) != nil {
		return nil
	}
	number, ok := object[key].(float64)
	if !ok || number <= 0 {
		return nil
	}
	result := uint64(number)
	return &result
}
