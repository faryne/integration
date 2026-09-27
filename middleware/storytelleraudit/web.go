package storytelleraudit

import (
	"encoding/json"
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

// WebSuccess 在 handler 完成且回傳 2xx 後才送 audit event；P2 才處理 denied／failed。
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
	if len(parts) >= 3 && parts[0] == "storyteller" && parts[1] == "projects" {
		return parts[2]
	}
	return ""
}

func webAuditArguments(ctx fiber.Ctx) map[string]any {
	arguments := map[string]any{}
	_ = json.Unmarshal(ctx.Body(), &arguments)
	for param, key := range map[string]string{
		"project": "project_public_id", "story": "story_public_id", "volume": "volume_public_id",
		"lore": "lore_public_id", "asset": "asset_public_id", "collection": "collection_public_id", "version": "version_id",
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
	}
	publicID, _ := arguments[key].(string)
	if publicID == "" {
		publicID = stringField(result, "public_id")
	}
	return targetType, publicID
}

func stringField(value any, key string) string {
	data, _ := json.Marshal(value)
	var object map[string]any
	if json.Unmarshal(data, &object) != nil {
		return ""
	}
	result, _ := object[key].(string)
	return result
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
