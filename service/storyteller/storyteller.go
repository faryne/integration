package storyteller

import (
	"context"
	"crypto/md5"
	"crypto/rand"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"regexp"
	"strings"
	"time"
	"unicode/utf8"

	storytellerModel "faryne.dev/model/entity/storyteller"
	"faryne.dev/repository"
	authRepo "faryne.dev/repository/auth"
	storytellerRepo "faryne.dev/repository/storyteller"
	"faryne.dev/service/log"
)

var whitespaceRegexp = regexp.MustCompile(`\s+`)
var unsafeSlugRegexp = regexp.MustCompile(`[^\p{L}\p{N}._~-]+`)
var slugUnderscoreRegexp = regexp.MustCompile(`_+`)

type Service struct {
	repo *storytellerRepo.Repository
}

type agentRunRepository interface {
	ProjectByPublicIDForUser(userID uint64, publicID string) (*storytellerModel.Project, error)
	Story(projectID uint64, publicID string) (*storytellerModel.Story, error)
	Agent(userID, id uint64) (*storytellerModel.Agent, error)
	ProviderAPIKey(userID, id uint64) (*storytellerModel.ProviderAPIKey, error)
	CreateStoryChatWithMessages(chat *storytellerModel.StoryChat, messages []storytellerModel.StoryChatMessage, usage *storytellerModel.AgentUsageLog) error
}

type aiProviderFactory func(provider storytellerModel.AgentProvider) (AIProvider, error)

func NewService() *Service {
	return &Service{repo: storytellerRepo.NewRepository()}
}

func RunRotateStorytellerAgentAPIKeys() {
	if err := NewService().RotateProviderAPIKeys(); err != nil {
		log.Logger().Error("Storyteller provider api key rotation failed: " + err.Error())
	}
}

func (s *Service) RotateProviderAPIKeys() error {
	keys, err := s.repo.ActiveProviderAPIKeysForRotation()
	if err != nil {
		return err
	}
	for index := range keys {
		apiKey, err := decryptProviderAPIKey(&keys[index])
		if err != nil {
			return err
		}
		if strings.TrimSpace(apiKey) == "" {
			continue
		}
		if err := applyEncryptedProviderAPIKey(&keys[index], apiKey); err != nil {
			return err
		}
		if err := s.repo.UpdateProviderAPIKeyEncryption(&keys[index]); err != nil {
			return err
		}
	}
	return nil
}

func (s *Service) PublicProjects() ([]storytellerModel.ProjectOutput, error) {
	projects, err := s.repo.PublicProjects()
	if err != nil {
		return nil, err
	}
	return s.projectOutputs(projects, false)
}

func (s *Service) PublicProject(projectValue string) (*storytellerModel.ProjectOutput, error) {
	publicID := strings.SplitN(projectValue, "-", 2)[0]
	project, err := s.repo.ProjectByPublicID(publicID)
	if err != nil {
		return nil, err
	}
	return s.projectOutput(project, false)
}

func (s *Service) SharedProject(token string) (*storytellerModel.ProjectOutput, error) {
	project, err := s.repo.ProjectByShareToken(strings.TrimSpace(token))
	if err != nil {
		return nil, err
	}
	return s.projectOutput(project, false)
}

func (s *Service) Projects(userID uint64) ([]storytellerModel.ProjectOutput, error) {
	projects, err := s.repo.Projects(userID)
	if err != nil {
		return nil, err
	}
	return s.projectOutputs(projects, true)
}

func (s *Service) Project(userID uint64, publicID string) (*storytellerModel.ProjectOutput, error) {
	project, err := s.repo.ProjectByPublicIDForUser(userID, publicID)
	if err != nil {
		return nil, err
	}
	return s.projectOutput(project, true)
}

func (s *Service) uniqueProjectSlug(userID uint64, slug string, excludeProjectID uint64) (string, error) {
	taken, err := s.repo.ProjectSlugTaken(userID, slug, excludeProjectID)
	if err != nil {
		return "", err
	}
	if !taken {
		return slug, nil
	}
	for i := 0; i < 5; i++ {
		candidate := slug + "-" + randomID()[:6]
		taken, err := s.repo.ProjectSlugTaken(userID, candidate, excludeProjectID)
		if err != nil {
			return "", err
		}
		if !taken {
			return candidate, nil
		}
	}
	return slug + "-" + randomID(), nil
}

func (s *Service) CreateProject(userID uint64, input storytellerModel.ProjectRequest) (*storytellerModel.ProjectOutput, error) {
	input = normalizeProjectRequest(input)
	if err := validateProject(input); err != nil {
		return nil, err
	}
	slug, err := s.uniqueProjectSlug(userID, safeProjectSlug(input.Name), 0)
	if err != nil {
		return nil, err
	}
	project := &storytellerModel.Project{
		PublicID:    randomID(),
		UserID:      userID,
		Name:        strings.TrimSpace(input.Name),
		Slug:        slug,
		Description: strings.TrimSpace(input.Description),
		Visibility:  input.Visibility,
		Rating:      input.Rating,
		Tags:        encodeProjectTags(input.Tags),
	}
	if project.Visibility == storytellerModel.ProjectVisibilityUnlisted {
		project.ShareToken = randomID() + randomID()
	}
	if err := s.repo.CreateProject(project); err != nil {
		return nil, err
	}
	return outputProject(*project), nil
}

func (s *Service) UpdateProject(userID uint64, publicID string, input storytellerModel.ProjectRequest) (*storytellerModel.ProjectOutput, error) {
	input = normalizeProjectRequest(input)
	if err := validateProject(input); err != nil {
		return nil, err
	}
	project, err := s.repo.ProjectByPublicIDForUser(userID, publicID)
	if err != nil {
		return nil, err
	}
	newSlug := safeProjectSlug(input.Slug)
	if newSlug != project.Slug {
		taken, err := s.repo.ProjectSlugTaken(userID, newSlug, project.ID)
		if err != nil {
			return nil, err
		}
		if taken {
			return nil, errors.New("這個網址已經被你的其他專案使用，請換一個。")
		}
	}
	previousVisibility := project.Visibility
	project.Name = strings.TrimSpace(input.Name)
	project.Slug = newSlug
	project.Description = strings.TrimSpace(input.Description)
	project.Visibility = input.Visibility
	project.Rating = input.Rating
	project.Tags = encodeProjectTags(input.Tags)
	if project.Visibility == storytellerModel.ProjectVisibilityUnlisted {
		if previousVisibility != storytellerModel.ProjectVisibilityUnlisted {
			project.ShareToken = randomID() + randomID()
		}
	} else {
		project.ShareToken = ""
	}
	if err := s.repo.UpdateProject(project); err != nil {
		return nil, err
	}
	return s.projectOutput(project, true)
}

func (s *Service) DeleteProject(userID uint64, publicID string) error {
	project, err := s.repo.ProjectByPublicIDForUser(userID, publicID)
	if err != nil {
		return err
	}
	return s.repo.DeleteProject(project)
}

func (s *Service) Agents(userID uint64) ([]storytellerModel.Agent, error) {
	return s.repo.Agents(userID)
}

func (s *Service) Agent(userID, id uint64) (*storytellerModel.Agent, error) {
	return s.repo.Agent(userID, id)
}

func (s *Service) AgentProviderModels() ([]storytellerModel.AgentProviderModels, error) {
	return s.repo.AgentProviderModels()
}

func (s *Service) CreateAgent(userID uint64, input storytellerModel.AgentRequest) (*storytellerModel.Agent, error) {
	input = normalizeAgentRequest(input)
	providerModel, err := s.validateAgent(input, true)
	if err != nil {
		return nil, err
	}
	if err := s.validateAgentProviderAPIKey(userID, input); err != nil {
		return nil, err
	}
	agent := &storytellerModel.Agent{
		UserID:           userID,
		Name:             strings.TrimSpace(input.Name),
		Provider:         input.Provider,
		ModelName:        strings.TrimSpace(input.ModelName),
		AgentModelID:     agentModelID(providerModel),
		ProviderAPIKeyID: input.ProviderAPIKeyID,
		DefaultPrompt:    strings.TrimSpace(input.DefaultPrompt),
	}
	if err := s.repo.CreateAgent(agent); err != nil {
		return nil, err
	}
	return agent, nil
}

func (s *Service) UpdateAgent(userID, id uint64, input storytellerModel.AgentRequest) (*storytellerModel.Agent, error) {
	input = normalizeAgentRequest(input)
	providerModel, err := s.validateAgent(input, false)
	if err != nil {
		return nil, err
	}
	if err := s.validateAgentProviderAPIKey(userID, input); err != nil {
		return nil, err
	}
	agent, err := s.repo.Agent(userID, id)
	if err != nil {
		return nil, err
	}
	agent.Name = strings.TrimSpace(input.Name)
	agent.Provider = input.Provider
	agent.ModelName = strings.TrimSpace(input.ModelName)
	agent.AgentModelID = agentModelID(providerModel)
	if input.ProviderAPIKeyID != nil {
		agent.ProviderAPIKeyID = input.ProviderAPIKeyID
	}
	agent.DefaultPrompt = strings.TrimSpace(input.DefaultPrompt)
	if err := s.repo.UpdateAgent(agent); err != nil {
		return nil, err
	}
	return agent, nil
}

func (s *Service) validateAgentProviderAPIKey(userID uint64, input storytellerModel.AgentRequest) error {
	if input.ProviderAPIKeyID == nil {
		return nil
	}
	key, err := s.repo.ProviderAPIKey(userID, *input.ProviderAPIKeyID)
	if err != nil {
		return err
	}
	if key.Provider != input.Provider {
		return errors.New("provider_apikey_id does not match provider")
	}
	return nil
}

func (s *Service) ProviderAPIKeys(userID uint64) ([]storytellerModel.ProviderAPIKeyOutput, error) {
	rows, err := s.repo.ProviderAPIKeys(userID)
	if err != nil {
		return nil, err
	}
	outputs := make([]storytellerModel.ProviderAPIKeyOutput, 0, len(rows))
	for _, row := range rows {
		outputs = append(outputs, providerAPIKeyOutput(row))
	}
	return outputs, nil
}

func (s *Service) CreateProviderAPIKey(userID uint64, input storytellerModel.ProviderAPIKeyRequest) (*storytellerModel.ProviderAPIKeyOutput, error) {
	if err := s.validateProviderAPIKeyRequest(input); err != nil {
		return nil, err
	}
	row := &storytellerModel.ProviderAPIKey{
		UserID:   userID,
		Provider: input.Provider,
		Label:    strings.TrimSpace(input.Label),
	}
	if err := applyEncryptedProviderAPIKey(row, input.APIKey); err != nil {
		return nil, err
	}
	if err := s.repo.CreateProviderAPIKey(row); err != nil {
		return nil, err
	}
	output := providerAPIKeyOutput(*row)
	return &output, nil
}

func (s *Service) UpdateProviderAPIKey(userID, id uint64, input storytellerModel.ProviderAPIKeyUpdateRequest) (*storytellerModel.ProviderAPIKeyOutput, error) {
	row, err := s.repo.ProviderAPIKey(userID, id)
	if err != nil {
		return nil, err
	}
	row.Label = strings.TrimSpace(input.Label)
	if strings.TrimSpace(input.APIKey) != "" {
		if err := applyEncryptedProviderAPIKey(row, input.APIKey); err != nil {
			return nil, err
		}
		// 金鑰內容換了，先前的測試結果就不再有意義，回到「未測試」狀態。
		row.LastTestedAt = nil
		row.LastTestOK = nil
	}
	if err := s.repo.UpdateProviderAPIKey(row); err != nil {
		return nil, err
	}
	output := providerAPIKeyOutput(*row)
	return &output, nil
}

func (s *Service) DeleteProviderAPIKey(userID, id uint64) error {
	row, err := s.repo.ProviderAPIKey(userID, id)
	if err != nil {
		return err
	}
	return s.repo.DeleteProviderAPIKey(row)
}

func (s *Service) TestProviderAPIKey(ctx context.Context, userID, id uint64) error {
	key, err := s.repo.ProviderAPIKey(userID, id)
	if err != nil {
		return err
	}
	providerModels, err := s.repo.AgentProviderModels()
	if err != nil {
		return err
	}
	modelName := ""
	for _, providerModel := range providerModels {
		if providerModel.Provider == key.Provider && len(providerModel.Models) > 0 {
			modelName = providerModel.Models[0].Name
			break
		}
	}
	if modelName == "" {
		return errors.New("no model configured for this provider yet")
	}
	provider, err := NewAIProvider(key.Provider)
	if err != nil {
		return err
	}
	apiKey, err := decryptProviderAPIKey(key)
	if err != nil {
		return err
	}
	_, testErr := provider.Generate(ctx, AIProviderRequest{
		APIKey:       apiKey,
		ModelName:    modelName,
		SystemPrompt: "Reply with exactly one word: OK",
		UserPrompt:   "OK",
	})
	// 不論成功或失敗都寫回資料庫，讓金鑰列表重新整理後仍看得到上一次測試的結果。
	now := time.Now()
	ok := testErr == nil
	key.LastTestedAt = &now
	key.LastTestOK = &ok
	if err := s.repo.UpdateProviderAPIKeyTestResult(key); err != nil {
		return err
	}
	return testErr
}

const usageLogPageSizeDefault = 20
const usageLogPageSizeMax = 50

// parseUsageMonth 把 "2026-07" 這種月份字串轉成 [from, to) 的時間區間，供用量查詢篩選 created_at。
func parseUsageMonth(month string) (time.Time, time.Time, error) {
	from, err := time.ParseInLocation("2006-01", month, time.Local)
	if err != nil {
		return time.Time{}, time.Time{}, errors.New("month must be in YYYY-MM format")
	}
	return from, from.AddDate(0, 1, 0), nil
}

func (s *Service) AgentUsageSummary(userID uint64, month string) ([]storytellerModel.AgentUsageSummaryRow, error) {
	from, to, err := parseUsageMonth(month)
	if err != nil {
		return nil, err
	}
	return s.repo.AgentUsageSummary(userID, from, to)
}

func (s *Service) AgentUsageLogs(userID, providerAPIKeyID, agentID uint64, month string, page, pageSize int) ([]storytellerModel.AgentUsageLogRow, int64, error) {
	from, to, err := parseUsageMonth(month)
	if err != nil {
		return nil, 0, err
	}
	// 確認這把 Key 與這個 Agent 都屬於呼叫者本人，避免用別人的 id 猜出用量明細。
	if _, err := s.repo.ProviderAPIKey(userID, providerAPIKeyID); err != nil {
		return nil, 0, err
	}
	if _, err := s.repo.Agent(userID, agentID); err != nil {
		return nil, 0, err
	}
	if page < 1 {
		page = 1
	}
	if pageSize < 1 {
		pageSize = usageLogPageSizeDefault
	}
	if pageSize > usageLogPageSizeMax {
		pageSize = usageLogPageSizeMax
	}
	return s.repo.AgentUsageLogs(userID, providerAPIKeyID, agentID, from, to, (page-1)*pageSize, pageSize)
}

func (s *Service) validateProviderAPIKeyRequest(input storytellerModel.ProviderAPIKeyRequest) error {
	if strings.TrimSpace(input.APIKey) == "" {
		return errors.New("api_key is required")
	}
	providerModels, err := s.repo.AgentProviderModels()
	if err != nil {
		return err
	}
	for _, providerModel := range providerModels {
		if providerModel.Provider == input.Provider {
			return nil
		}
	}
	return errors.New("invalid provider")
}

func providerAPIKeyOutput(row storytellerModel.ProviderAPIKey) storytellerModel.ProviderAPIKeyOutput {
	return storytellerModel.ProviderAPIKeyOutput{
		ID:           row.ID,
		Provider:     row.Provider,
		Label:        row.Label,
		LastTestedAt: row.LastTestedAt,
		LastTestOK:   row.LastTestOK,
		CreatedAt:    row.CreatedAt,
		UpdatedAt:    row.UpdatedAt,
	}
}

func (s *Service) DeleteAgent(userID, id uint64) error {
	agent, err := s.repo.Agent(userID, id)
	if err != nil {
		return err
	}
	return s.repo.DeleteAgent(agent)
}

func (s *Service) AgentPromptVersions(userID, agentID uint64) ([]storytellerModel.AgentPromptVersion, error) {
	if _, err := s.repo.Agent(userID, agentID); err != nil {
		return nil, err
	}
	return s.repo.AgentPromptVersions(agentID)
}

func (s *Service) AgentPromptVersion(userID, agentID, versionID uint64) (*storytellerModel.AgentPromptVersion, error) {
	if _, err := s.repo.Agent(userID, agentID); err != nil {
		return nil, err
	}
	return s.repo.AgentPromptVersion(agentID, versionID)
}

func (s *Service) RunAgent(ctx context.Context, userID uint64, projectPublicID, storyPublicID string, agentID uint64, input storytellerModel.AgentRunRequest) (*storytellerModel.AgentRunResponse, error) {
	return runAgent(ctx, s.repo, NewAIProvider, userID, projectPublicID, storyPublicID, agentID, input)
}

func (s *Service) RunLoreAgent(ctx context.Context, userID uint64, projectPublicID, lorePublicID string, agentID uint64, input storytellerModel.AgentRunRequest) (*storytellerModel.AgentRunResponse, error) {
	if err := validateAgentRunRequest(input); err != nil {
		return nil, err
	}
	project, err := s.repo.ProjectByPublicIDForUser(userID, projectPublicID)
	if err != nil {
		return nil, err
	}
	lore, err := s.repo.Lore(project.ID, lorePublicID)
	if err != nil {
		return nil, err
	}
	agent, err := s.repo.Agent(userID, agentID)
	if err != nil {
		return nil, err
	}
	providerAPIKeyRow, err := resolveAgentProviderAPIKey(s.repo.ProviderAPIKey, userID, agent, input.ProviderAPIKeyID)
	if err != nil {
		return nil, err
	}
	provider, err := NewAIProvider(agent.Provider)
	if err != nil {
		return nil, err
	}
	apiKey, err := decryptProviderAPIKey(providerAPIKeyRow)
	if err != nil {
		return nil, err
	}
	systemPrompt, userPrompt := buildAgentRunPrompts(*agent, input)
	response, err := provider.Generate(ctx, AIProviderRequest{
		APIKey:       apiKey,
		ModelName:    agent.ModelName,
		SystemPrompt: systemPrompt,
		UserPrompt:   userPrompt,
	})
	if err != nil {
		return nil, err
	}
	output := &storytellerModel.AgentRunResponse{
		AgentID:      agent.ID,
		Provider:     agent.Provider,
		ModelName:    agent.ModelName,
		Mode:         input.Mode,
		Result:       response.Result,
		FinishReason: response.FinishReason,
	}
	if response.Usage != nil {
		output.Usage = &storytellerModel.AgentRunUsage{
			InputTokens:  response.Usage.InputTokens,
			OutputTokens: response.Usage.OutputTokens,
			TotalTokens:  response.Usage.TotalTokens,
		}
	}
	chat, messages := buildLoreAgentRunChat(userID, lore.ID, *agent, input, output)
	usage := buildAgentUsageLog(userID, providerAPIKeyRow.ID, *agent, output)
	if err := s.repo.CreateStoryChatWithMessages(chat, messages, usage); err != nil {
		return nil, err
	}
	return output, nil
}

var (
	errAgentProviderAPIKeyNotConfigured = errors.New("agent has no provider api key configured")
	errAgentProviderAPIKeyMismatch      = errors.New("provider api key does not match agent provider")
)

func resolveAgentProviderAPIKey(lookup func(userID, id uint64) (*storytellerModel.ProviderAPIKey, error), userID uint64, agent *storytellerModel.Agent, overrideID *uint64) (*storytellerModel.ProviderAPIKey, error) {
	keyID := agent.ProviderAPIKeyID
	if overrideID != nil {
		keyID = overrideID
	}
	if keyID == nil {
		return nil, errAgentProviderAPIKeyNotConfigured
	}
	key, err := lookup(userID, *keyID)
	if err != nil {
		return nil, err
	}
	if key.Provider != agent.Provider {
		return nil, errAgentProviderAPIKeyMismatch
	}
	return key, nil
}

func runAgent(ctx context.Context, repo agentRunRepository, providerFactory aiProviderFactory, userID uint64, projectPublicID, storyPublicID string, agentID uint64, input storytellerModel.AgentRunRequest) (*storytellerModel.AgentRunResponse, error) {
	if err := validateAgentRunRequest(input); err != nil {
		return nil, err
	}
	project, err := repo.ProjectByPublicIDForUser(userID, projectPublicID)
	if err != nil {
		return nil, err
	}
	story, err := repo.Story(project.ID, storyPublicID)
	if err != nil {
		return nil, err
	}
	agent, err := repo.Agent(userID, agentID)
	if err != nil {
		return nil, err
	}
	providerAPIKeyRow, err := resolveAgentProviderAPIKey(repo.ProviderAPIKey, userID, agent, input.ProviderAPIKeyID)
	if err != nil {
		return nil, err
	}
	provider, err := providerFactory(agent.Provider)
	if err != nil {
		return nil, err
	}
	apiKey, err := decryptProviderAPIKey(providerAPIKeyRow)
	if err != nil {
		return nil, err
	}
	systemPrompt, userPrompt := buildAgentRunPrompts(*agent, input)
	response, err := provider.Generate(ctx, AIProviderRequest{
		APIKey:       apiKey,
		ModelName:    agent.ModelName,
		SystemPrompt: systemPrompt,
		UserPrompt:   userPrompt,
	})
	if err != nil {
		return nil, err
	}
	output := &storytellerModel.AgentRunResponse{
		AgentID:      agent.ID,
		Provider:     agent.Provider,
		ModelName:    agent.ModelName,
		Mode:         input.Mode,
		Result:       response.Result,
		FinishReason: response.FinishReason,
	}
	if response.Usage != nil {
		output.Usage = &storytellerModel.AgentRunUsage{
			InputTokens:  response.Usage.InputTokens,
			OutputTokens: response.Usage.OutputTokens,
			TotalTokens:  response.Usage.TotalTokens,
		}
	}
	chat, messages := buildAgentRunChat(userID, story.ID, *agent, input, output)
	usage := buildAgentUsageLog(userID, providerAPIKeyRow.ID, *agent, output)
	if err := repo.CreateStoryChatWithMessages(chat, messages, usage); err != nil {
		return nil, err
	}
	return output, nil
}

// buildAgentUsageLog 記錄這次執行「實際解析後」使用的 apikey_id，
// 不論它來自 request 的單次覆寫還是 Agent 的預設設定；沒有 usage 資訊時不寫入紀錄。
func buildAgentUsageLog(userID, providerAPIKeyID uint64, agent storytellerModel.Agent, output *storytellerModel.AgentRunResponse) *storytellerModel.AgentUsageLog {
	if output == nil || output.Usage == nil {
		return nil
	}
	return &storytellerModel.AgentUsageLog{
		UserID:           userID,
		ProviderAPIKeyID: providerAPIKeyID,
		AgentID:          agent.ID,
		Provider:         agent.Provider,
		ModelName:        agent.ModelName,
		InputTokens:      output.Usage.InputTokens,
		OutputTokens:     output.Usage.OutputTokens,
		TotalTokens:      output.Usage.TotalTokens,
	}
}

func (s *Service) Stories(userID uint64, projectPublicID string) ([]storytellerModel.Story, error) {
	project, err := s.repo.ProjectByPublicIDForUser(userID, projectPublicID)
	if err != nil {
		return nil, err
	}
	return s.repo.Stories(project.ID)
}

func (s *Service) Story(userID uint64, projectPublicID, storyPublicID string) (*storytellerModel.Story, error) {
	project, err := s.repo.ProjectByPublicIDForUser(userID, projectPublicID)
	if err != nil {
		return nil, err
	}
	return s.repo.Story(project.ID, storyPublicID)
}

func (s *Service) CreateStory(userID uint64, projectPublicID string, input storytellerModel.StoryRequest) (*storytellerModel.Story, error) {
	input = normalizeStoryRequest(input)
	if err := validateStory(input); err != nil {
		return nil, err
	}
	project, err := s.repo.ProjectByPublicIDForUser(userID, projectPublicID)
	if err != nil {
		return nil, err
	}
	story := &storytellerModel.Story{
		PublicID:      randomID(),
		ProjectID:     project.ID,
		Title:         strings.TrimSpace(input.Title),
		Summary:       strings.TrimSpace(input.Summary),
		Status:        input.Status,
		Sort:          input.Sort,
		LatestContent: input.Content,
		WordCount:     wordCount(input.Content),
	}
	version := buildStoryVersion(*story)
	if err := s.repo.CreateStoryWithVersion(story, version); err != nil {
		return nil, err
	}
	return story, nil
}

func (s *Service) UpdateStory(userID uint64, projectPublicID, storyPublicID string, input storytellerModel.StoryRequest) (*storytellerModel.Story, error) {
	input = normalizeStoryRequest(input)
	if err := validateStory(input); err != nil {
		return nil, err
	}
	project, err := s.repo.ProjectByPublicIDForUser(userID, projectPublicID)
	if err != nil {
		return nil, err
	}
	story, err := s.repo.Story(project.ID, storyPublicID)
	if err != nil {
		return nil, err
	}
	story.Title = strings.TrimSpace(input.Title)
	story.Summary = strings.TrimSpace(input.Summary)
	story.Status = input.Status
	story.Sort = input.Sort
	story.LatestContent = input.Content
	story.WordCount = wordCount(input.Content)
	version := buildStoryVersion(*story)
	if err := s.repo.UpdateStoryWithVersion(story, version); err != nil {
		return nil, err
	}
	return story, nil
}

func (s *Service) DeleteStory(userID uint64, projectPublicID, storyPublicID string) error {
	project, err := s.repo.ProjectByPublicIDForUser(userID, projectPublicID)
	if err != nil {
		return err
	}
	story, err := s.repo.Story(project.ID, storyPublicID)
	if err != nil {
		return err
	}
	return s.repo.DeleteStory(story)
}

func (s *Service) StoryVersions(userID uint64, projectPublicID, storyPublicID string) ([]storytellerModel.StoryVersion, error) {
	story, err := s.storyForUserProject(userID, projectPublicID, storyPublicID)
	if err != nil {
		return nil, err
	}
	return s.repo.StoryVersions(story.ID)
}

func (s *Service) StoryVersion(userID uint64, projectPublicID, storyPublicID string, versionID uint64) (*storytellerModel.StoryVersion, error) {
	story, err := s.storyForUserProject(userID, projectPublicID, storyPublicID)
	if err != nil {
		return nil, err
	}
	return s.repo.StoryVersion(story.ID, versionID)
}

// publicPublishedStory 回傳讀者可讀取的故事（專案為公開或不公開連結、故事狀態為公開中），
// 供書籤與版本查詢等「讀者視角」功能共用權限判斷，不要求使用者為專案擁有者。
func (s *Service) publicPublishedStory(projectPublicID, storyPublicID string) (*storytellerModel.Story, error) {
	project, err := s.repo.ProjectByPublicIDForFavorite(projectPublicID)
	if err != nil {
		return nil, err
	}
	return s.repo.PublishedStory(project.ID, storyPublicID)
}

func (s *Service) PublicStoryLatestVersion(projectPublicID, storyPublicID string) (*storytellerModel.StoryVersion, error) {
	story, err := s.publicPublishedStory(projectPublicID, storyPublicID)
	if err != nil {
		return nil, err
	}
	return s.repo.LatestStoryVersion(story.ID)
}

func (s *Service) PublicStoryVersions(projectPublicID, storyPublicID string) ([]storytellerModel.StoryVersion, error) {
	story, err := s.publicPublishedStory(projectPublicID, storyPublicID)
	if err != nil {
		return nil, err
	}
	return s.repo.StoryVersions(story.ID)
}

func (s *Service) ProjectStoryBookmarks(userID uint64, projectPublicID string) ([]storytellerModel.StoryBookmarkOutput, error) {
	project, err := s.repo.ProjectByPublicIDForFavorite(projectPublicID)
	if err != nil {
		return nil, err
	}
	rows, err := s.repo.ProjectStoryBookmarks(userID, project.ID)
	if err != nil {
		return nil, err
	}
	for i := range rows {
		rows[i].LinePreview = stripBookmarkLineMarker(rows[i].LinePreview)
	}
	return rows, nil
}

// storyMarkerPattern 比照前端 wysiwygDemo/parser.ts 的 MARKER_PATTERN：段落 marker 開頭是
// markerId，接著可選的 align／comment／commentColor 屬性，這幾個屬性的值這裡不需要解析出來，
// 比對到就整段丟棄即可（順序必須跟前端一致：align 在前、comment 居中、commentColor 殿後，
// 三個都可省略）。
var storyMarkerPattern = regexp.MustCompile(
	`^⟦([^⟧\s]*)(?: align="(?:left|center|right)")?(?: comment="(?:[^"\\]|\\.)*")?(?: commentColor="(?:yellow|pink|blue|green|purple)")?⟧([\s\S]*)⟦/([^⟧\s]*)⟧$`,
)

// splitHeadingAndMarkerContent 拿掉標題前綴（回傳 headingLevel）跟段落 marker（含 align／
// comment／commentColor 屬性），回傳段落真正的可讀內容。是 stripBookmarkLineMarker 跟
// wordCount 共用的底層邏輯，DB 裡的 content 存的是含 marker 語法的原始行（見
// storyteller_story_versions 遷移後的格式），這兩個地方都需要在 Go 這邊做語法層面的清理。
func splitHeadingAndMarkerContent(line string) (int, string) {
	headingLevel := 0
	for headingLevel < 6 && headingLevel < len(line) && line[headingLevel] == '#' {
		headingLevel++
	}
	content := line
	if headingLevel > 0 && headingLevel < len(line) && line[headingLevel] == ' ' {
		content = line[headingLevel+1:]
	} else {
		headingLevel = 0
	}

	if match := storyMarkerPattern.FindStringSubmatch(content); match != nil && match[1] == match[3] {
		content = match[2]
	}

	return headingLevel, content
}

// storyInlineMarkerPattern 比照前端 wysiwygCore/parser.ts 的行內 marker（span 文字顏色、
// a 連結等）：`⟦<type>-<id> attr="..."⟧` 開頭跟 `⟦/<type>-<id>⟧` 結尾。這裡不管配對、
// 單純把記號本身抽掉（保留被包住的文字），因為字數計算跟書籤預覽都只需要看得到的文字。
// 之後加腳注時往 `(?:span|a)` 裡多加一個 type 即可。
var storyInlineMarkerPattern = regexp.MustCompile(
	`⟦/?(?:span|a)-[^⟧\s]+(?: [A-Za-z]+="(?:[^"\\]|\\.)*")*⟧`,
)

// stripStoryInlineMarkers 把一段內容裡的行內 marker 記號（span 顏色等）抽掉，只留下被包住的文字。
func stripStoryInlineMarkers(content string) string {
	return storyInlineMarkerPattern.ReplaceAllString(content, "")
}

// stripBookmarkLineMarker 去掉書籤預覽文字裡的段落 marker（含 align/comment/commentColor
// 屬性）跟行內 marker（span 顏色等），保留標題前綴，只留下可讀文字。邏輯跟前端
// stripMarkerForDiffLine 一致，方便未來對照維護。
func stripBookmarkLineMarker(line string) string {
	headingLevel, content := splitHeadingAndMarkerContent(line)
	content = stripStoryInlineMarkers(content)
	if headingLevel > 0 {
		return strings.Repeat("#", headingLevel) + " " + content
	}
	return content
}

// wordCountInlineDelimiters 比照前端 whitelist.ts 的 PARSE_DELIMITERS，長的寫法要排在前面
// （例如 ** 要早於 *），避免誤判成短的那個。
var wordCountInlineDelimiters = []string{"**", "__", "++", "*", "~", "^"}

// stripInlineDelimiters 拿掉行內樣式 delimiter（粗體/底線/斜體/上下標的記號），只留下記號
// 包住的文字本身，邏輯對應前端 parseInline 把 delimiter 轉成 marks、只留 run.text 的效果。
func stripInlineDelimiters(text string) string {
	var b strings.Builder
	for i := 0; i < len(text); {
		matched := false
		for _, d := range wordCountInlineDelimiters {
			if strings.HasPrefix(text[i:], d) {
				i += len(d)
				matched = true
				break
			}
		}
		if !matched {
			_, size := utf8.DecodeRuneInString(text[i:])
			b.WriteString(text[i : i+size])
			i += size
		}
	}
	return b.String()
}

func (s *Service) StoryBookmarks(userID uint64, projectPublicID, storyPublicID string) ([]storytellerModel.StoryBookmark, error) {
	story, err := s.publicPublishedStory(projectPublicID, storyPublicID)
	if err != nil {
		return nil, err
	}
	return s.repo.StoryBookmarks(userID, story.ID)
}

func (s *Service) CreateStoryBookmark(userID uint64, projectPublicID, storyPublicID string, versionID uint64, lineIndex int) (*storytellerModel.StoryBookmark, error) {
	story, err := s.publicPublishedStory(projectPublicID, storyPublicID)
	if err != nil {
		return nil, err
	}
	latest, err := s.repo.LatestStoryVersion(story.ID)
	if err != nil {
		return nil, err
	}
	if latest.ID != versionID {
		return nil, errors.New("只能對最新版本加入書籤")
	}
	if existing, err := s.repo.StoryBookmark(userID, versionID, lineIndex); err == nil {
		return existing, nil
	}
	row := &storytellerModel.StoryBookmark{
		UserID:         userID,
		StoryID:        story.ID,
		StoryVersionID: versionID,
		LineIndex:      lineIndex,
	}
	if err := s.repo.CreateStoryBookmark(row); err != nil {
		return nil, err
	}
	return row, nil
}

func (s *Service) DeleteStoryBookmark(userID uint64, projectPublicID, storyPublicID string, versionID uint64, lineIndex int) error {
	if _, err := s.publicPublishedStory(projectPublicID, storyPublicID); err != nil {
		return err
	}
	return s.repo.DeleteStoryBookmark(userID, versionID, lineIndex)
}

func (s *Service) Lores(userID uint64, projectPublicID string) ([]storytellerModel.Lore, error) {
	project, err := s.repo.ProjectByPublicIDForUser(userID, projectPublicID)
	if err != nil {
		return nil, err
	}
	return s.repo.Lores(project.ID)
}

func (s *Service) Lore(userID uint64, projectPublicID, lorePublicID string) (*storytellerModel.Lore, error) {
	project, err := s.repo.ProjectByPublicIDForUser(userID, projectPublicID)
	if err != nil {
		return nil, err
	}
	return s.repo.Lore(project.ID, lorePublicID)
}

func (s *Service) CreateLore(userID uint64, projectPublicID string, input storytellerModel.LoreRequest) (*storytellerModel.Lore, error) {
	if err := validateLore(input); err != nil {
		return nil, err
	}
	project, err := s.repo.ProjectByPublicIDForUser(userID, projectPublicID)
	if err != nil {
		return nil, err
	}
	lore := &storytellerModel.Lore{
		PublicID:      randomID(),
		ProjectID:     project.ID,
		Title:         strings.TrimSpace(input.Title),
		LatestContent: input.Content,
		WordCount:     wordCount(input.Content),
	}
	version := buildLoreVersion(*lore)
	if err := s.repo.CreateLoreWithVersion(lore, version); err != nil {
		return nil, err
	}
	return lore, nil
}

func (s *Service) UpdateLore(userID uint64, projectPublicID, lorePublicID string, input storytellerModel.LoreRequest) (*storytellerModel.Lore, error) {
	if err := validateLore(input); err != nil {
		return nil, err
	}
	project, err := s.repo.ProjectByPublicIDForUser(userID, projectPublicID)
	if err != nil {
		return nil, err
	}
	lore, err := s.repo.Lore(project.ID, lorePublicID)
	if err != nil {
		return nil, err
	}
	lore.Title = strings.TrimSpace(input.Title)
	lore.LatestContent = input.Content
	lore.WordCount = wordCount(input.Content)
	version := buildLoreVersion(*lore)
	if err := s.repo.UpdateLoreWithVersion(lore, version); err != nil {
		return nil, err
	}
	return lore, nil
}

func (s *Service) DeleteLore(userID uint64, projectPublicID, lorePublicID string) error {
	project, err := s.repo.ProjectByPublicIDForUser(userID, projectPublicID)
	if err != nil {
		return err
	}
	lore, err := s.repo.Lore(project.ID, lorePublicID)
	if err != nil {
		return err
	}
	return s.repo.DeleteLore(lore)
}

func (s *Service) LoreVersions(userID uint64, projectPublicID, lorePublicID string) ([]storytellerModel.LoreVersion, error) {
	lore, err := s.loreForUserProject(userID, projectPublicID, lorePublicID)
	if err != nil {
		return nil, err
	}
	return s.repo.LoreVersions(lore.ID)
}

func (s *Service) LoreVersion(userID uint64, projectPublicID, lorePublicID string, versionID uint64) (*storytellerModel.LoreVersion, error) {
	lore, err := s.loreForUserProject(userID, projectPublicID, lorePublicID)
	if err != nil {
		return nil, err
	}
	return s.repo.LoreVersion(lore.ID, versionID)
}

func (s *Service) StoryChatMessages(userID uint64, projectPublicID, storyPublicID string, page, pageSize int) ([]storytellerModel.StoryChatMessageOutput, int64, error) {
	if page < 1 {
		page = 1
	}
	if pageSize < 1 {
		pageSize = 10
	}
	if pageSize > 50 {
		pageSize = 50
	}
	story, err := s.storyForUserProject(userID, projectPublicID, storyPublicID)
	if err != nil {
		return nil, 0, err
	}
	return s.repo.StoryChatMessages(story.ID, (page-1)*pageSize, pageSize)
}

func (s *Service) LoreChatMessages(userID uint64, projectPublicID, lorePublicID string, page, pageSize int) ([]storytellerModel.StoryChatMessageOutput, int64, error) {
	if page < 1 {
		page = 1
	}
	if pageSize < 1 {
		pageSize = 10
	}
	if pageSize > 50 {
		pageSize = 50
	}
	lore, err := s.loreForUserProject(userID, projectPublicID, lorePublicID)
	if err != nil {
		return nil, 0, err
	}
	return s.repo.LoreChatMessages(lore.ID, (page-1)*pageSize, pageSize)
}

func (s *Service) PublicUserProjects(penName string, page, pageSize int) ([]storytellerModel.ProjectOutput, int64, *storytellerModel.FavoriteAuthorOutput, error) {
	if page < 1 {
		page = 1
	}
	if pageSize < 1 {
		pageSize = 20
	}
	profile, err := s.repo.UserProfileByPenName(penName)
	if err != nil {
		return nil, 0, nil, err
	}
	projects, total, err := s.repo.PublicProjectsByUserID(profile.UserID, (page-1)*pageSize, pageSize)
	if err != nil {
		return nil, 0, nil, err
	}
	outputs, err := s.projectOutputs(projects, false)
	if err != nil {
		return nil, 0, nil, err
	}
	outputs, err = s.fillFavoriteCounts(outputs)
	if err != nil {
		return nil, 0, nil, err
	}
	projectCount, storyCount, wordCount, ratingCount, followerCount, averageRating, err := s.repo.PublicAuthorSummary(profile.UserID)
	if err != nil {
		return nil, 0, nil, err
	}
	author := &storytellerModel.FavoriteAuthorOutput{
		UserProfileOutput: *userProfileOutput(profile),
		ProjectCount:      projectCount,
		StoryCount:        storyCount,
		WordCount:         wordCount,
		RatingCount:       ratingCount,
		AverageRating:     averageRating,
		FollowerCount:     followerCount,
	}
	return outputs, total, author, nil
}

func (s *Service) PublicFavoriteProjects(penName string, viewerID uint64) ([]storytellerModel.ProjectOutput, error) {
	profile, err := s.repo.UserProfileByPenName(penName)
	if err != nil {
		return nil, err
	}
	isOwner := viewerID != 0 && viewerID == profile.UserID
	if profile.HideFavoriteProjects && !isOwner {
		return []storytellerModel.ProjectOutput{}, nil
	}
	projects, err := s.repo.PublicFavoriteProjects(profile.UserID, isOwner)
	if err != nil {
		return nil, err
	}
	outputs, err := s.projectOutputs(projects, false)
	if err != nil {
		return nil, err
	}
	outputs, err = s.fillFavoriteCounts(outputs)
	if err != nil {
		return nil, err
	}
	if isOwner {
		ids := make([]uint64, 0, len(outputs))
		for _, output := range outputs {
			ids = append(ids, output.ID)
		}
		hidden, err := s.repo.FavoriteProjectHiddenFlags(profile.UserID, ids)
		if err != nil {
			return nil, err
		}
		for i := range outputs {
			outputs[i].FavoriteHidden = hidden[outputs[i].ID]
		}
	}
	return outputs, nil
}

func (s *Service) PublicFavoriteAuthors(penName string, viewerID uint64) ([]storytellerModel.FavoriteAuthorOutput, error) {
	profile, err := s.repo.UserProfileByPenName(penName)
	if err != nil {
		return nil, err
	}
	isOwner := viewerID != 0 && viewerID == profile.UserID
	if profile.HideFavoriteAuthors && !isOwner {
		return []storytellerModel.FavoriteAuthorOutput{}, nil
	}
	favorites, err := s.repo.PublicFavoriteAuthors(profile.UserID, isOwner)
	if err != nil {
		return nil, err
	}
	outputs := make([]storytellerModel.FavoriteAuthorOutput, 0, len(favorites))
	for _, favorite := range favorites {
		output, err := s.favoriteAuthorOutput(favorite.AuthorUserID)
		if err != nil {
			return nil, err
		}
		output.Hidden = favorite.Hidden
		outputs = append(outputs, *output)
	}
	return outputs, nil
}

func (s *Service) SetFavoriteProjectVisibility(userID uint64, projectPublicID string, hidden bool) error {
	project, err := s.repo.ProjectByPublicIDForFavorite(projectPublicID)
	if err != nil {
		return err
	}
	return s.repo.SetFavoriteProjectHidden(userID, project.ID, hidden)
}

func (s *Service) SetFavoriteAuthorVisibility(userID, authorUserID uint64, hidden bool) error {
	return s.repo.SetFavoriteAuthorHidden(userID, authorUserID, hidden)
}

func (s *Service) fillFavoriteCounts(outputs []storytellerModel.ProjectOutput) ([]storytellerModel.ProjectOutput, error) {
	ids := make([]uint64, 0, len(outputs))
	for _, output := range outputs {
		ids = append(ids, output.ID)
	}
	counts, err := s.repo.ProjectFavoriteCounts(ids)
	if err != nil {
		return nil, err
	}
	for i := range outputs {
		outputs[i].FavoriteCount = counts[outputs[i].ID]
	}
	return outputs, nil
}

func (s *Service) FavoriteProjects(userID uint64) ([]storytellerModel.ProjectOutput, error) {
	projects, err := s.repo.FavoriteProjects(userID)
	if err != nil {
		return nil, err
	}
	outputs, err := s.projectOutputs(projects, false)
	if err != nil {
		return nil, err
	}
	ids := make([]uint64, 0, len(outputs))
	for _, output := range outputs {
		ids = append(ids, output.ID)
	}
	hidden, err := s.repo.FavoriteProjectHiddenFlags(userID, ids)
	if err != nil {
		return nil, err
	}
	for i := range outputs {
		outputs[i].FavoriteHidden = hidden[outputs[i].ID]
	}
	return outputs, nil
}

func (s *Service) FavoriteAuthors(userID uint64) ([]storytellerModel.FavoriteAuthorOutput, error) {
	favorites, err := s.repo.FavoriteAuthors(userID)
	if err != nil {
		return nil, err
	}
	outputs := make([]storytellerModel.FavoriteAuthorOutput, 0, len(favorites))
	for _, favorite := range favorites {
		output, err := s.favoriteAuthorOutput(favorite.AuthorUserID)
		if err != nil {
			return nil, err
		}
		output.Hidden = favorite.Hidden
		outputs = append(outputs, *output)
	}
	return outputs, nil
}

func (s *Service) FavoriteStatus(userID uint64, projectPublicID string) (map[string]bool, error) {
	project, err := s.repo.ProjectByPublicIDForFavorite(projectPublicID)
	if err != nil {
		return nil, err
	}
	ranking, err := s.repo.Ranking(userID, project.ID)
	if err != nil {
		return map[string]bool{"favorited": false}, nil
	}
	return map[string]bool{"favorited": ranking.DeletedAt == nil && ranking.IsFavorite}, nil
}

func (s *Service) CreateFavorite(userID uint64, projectPublicID string) (*storytellerModel.ProjectOutput, error) {
	project, err := s.repo.ProjectByPublicIDForFavorite(projectPublicID)
	if err != nil {
		return nil, err
	}
	ranking, err := s.repo.Ranking(userID, project.ID)
	if err == nil {
		ranking.DeletedAt = nil
		ranking.IsFavorite = true
		if err := s.repo.SaveRanking(ranking); err != nil {
			return nil, err
		}
		return s.projectOutput(project, false)
	}
	if err := s.repo.CreateRanking(&storytellerModel.ProjectRanking{
		UserID:     userID,
		ProjectID:  project.ID,
		IsFavorite: true,
	}); err != nil {
		return nil, err
	}
	return s.projectOutput(project, false)
}

func (s *Service) DeleteFavorite(userID uint64, projectPublicID string) error {
	project, err := s.repo.ProjectByPublicIDForFavorite(projectPublicID)
	if err != nil {
		return err
	}
	ranking, err := s.repo.Ranking(userID, project.ID)
	if err != nil {
		return nil
	}
	ranking.IsFavorite = false
	return s.repo.SaveRanking(ranking)
}

func (s *Service) AuthorFavoriteStatus(userID, authorUserID uint64) (map[string]bool, error) {
	favorite, err := s.repo.AuthorFavorite(userID, authorUserID)
	if err != nil {
		return map[string]bool{"favorited": false}, nil
	}
	return map[string]bool{"favorited": favorite.DeletedAt == nil}, nil
}

func (s *Service) CreateAuthorFavorite(userID, authorUserID uint64) (*storytellerModel.FavoriteAuthorOutput, error) {
	if userID == authorUserID {
		return nil, errors.New("cannot favorite yourself")
	}
	favorite, err := s.repo.AuthorFavorite(userID, authorUserID)
	if err == nil {
		favorite.DeletedAt = nil
		if err := s.repo.SaveAuthorFavorite(favorite); err != nil {
			return nil, err
		}
		return s.favoriteAuthorOutput(authorUserID)
	}
	if err := s.repo.CreateAuthorFavorite(&storytellerModel.AuthorFavorite{
		UserID:       userID,
		AuthorUserID: authorUserID,
	}); err != nil {
		return nil, err
	}
	return s.favoriteAuthorOutput(authorUserID)
}

func (s *Service) DeleteAuthorFavorite(userID, authorUserID uint64) error {
	favorite, err := s.repo.AuthorFavorite(userID, authorUserID)
	if err != nil {
		return nil
	}
	now := time.Now()
	favorite.DeletedAt = &now
	return s.repo.SaveAuthorFavorite(favorite)
}

func (s *Service) RankingStatus(userID uint64, projectPublicID string) (*storytellerModel.ProjectRankingOutput, error) {
	project, err := s.repo.ProjectByPublicIDForFavorite(projectPublicID)
	if err != nil {
		return nil, err
	}
	ranking, err := s.repo.Ranking(userID, project.ID)
	if err != nil || ranking.DeletedAt != nil {
		return &storytellerModel.ProjectRankingOutput{}, nil
	}
	return &storytellerModel.ProjectRankingOutput{Ranking: ranking.Ranking}, nil
}

func (s *Service) SaveRanking(userID uint64, projectPublicID string, input storytellerModel.ProjectRankingRequest) (*storytellerModel.ProjectRankingOutput, error) {
	if input.Ranking < 0.5 || input.Ranking > 5 || input.Ranking*2 != float64(int(input.Ranking*2)) {
		return nil, errors.New("ranking must be between 0.5 and 5 by 0.5 step")
	}
	project, err := s.repo.ProjectByPublicIDForFavorite(projectPublicID)
	if err != nil {
		return nil, err
	}
	value := input.Ranking
	ranking, err := s.repo.Ranking(userID, project.ID)
	if err == nil {
		ranking.DeletedAt = nil
		ranking.Ranking = &value
		if err := s.repo.SaveRanking(ranking); err != nil {
			return nil, err
		}
		return &storytellerModel.ProjectRankingOutput{Ranking: &value}, nil
	}
	if err := s.repo.CreateRanking(&storytellerModel.ProjectRanking{
		UserID:    userID,
		ProjectID: project.ID,
		Ranking:   &value,
	}); err != nil {
		return nil, err
	}
	return &storytellerModel.ProjectRankingOutput{Ranking: &value}, nil
}

func (s *Service) DeleteRanking(userID uint64, projectPublicID string) error {
	project, err := s.repo.ProjectByPublicIDForFavorite(projectPublicID)
	if err != nil {
		return err
	}
	ranking, err := s.repo.Ranking(userID, project.ID)
	if err != nil {
		return nil
	}
	ranking.Ranking = nil
	return s.repo.SaveRanking(ranking)
}

func (s *Service) UserProfile(userID uint64) (*storytellerModel.UserProfileOutput, error) {
	profile, err := s.repo.UserProfile(userID)
	if err != nil {
		if repository.IsRecordNotFound(err) {
			return defaultUserProfileOutput(userID), nil
		}
		return nil, err
	}
	return userProfileOutput(profile), nil
}

func (s *Service) SaveUserProfile(userID uint64, input storytellerModel.UserProfileRequest) (*storytellerModel.UserProfileOutput, error) {
	input = normalizeUserProfileRequest(input)
	if err := validatePenName(input.PenName); err != nil {
		return nil, err
	}
	if err := validateSNSLinks(input.SNSLinks); err != nil {
		return nil, err
	}
	if err := s.ensurePenNameAvailable(userID, input.PenName); err != nil {
		return nil, err
	}
	avatarURL := input.AvatarURL
	if input.UseDefaultAvatar {
		avatarURL = loginAvatarURL(userID)
	}
	profile, err := s.repo.UserProfileWithDeleted(userID)
	if err == nil {
		profile.PenName = input.PenName
		profile.Bio = input.Bio
		profile.UseDefaultAvatar = input.UseDefaultAvatar
		profile.AvatarURL = avatarURL
		profile.SNSLinks = input.SNSLinks
		profile.HideFavoriteProjects = input.HideFavoriteProjects
		profile.HideFavoriteAuthors = input.HideFavoriteAuthors
		profile.DeletedAt = nil
		if err := s.repo.SaveUserProfile(profile); err != nil {
			return nil, err
		}
		return userProfileOutput(profile), nil
	}
	if !repository.IsRecordNotFound(err) {
		return nil, err
	}
	profile = &storytellerModel.UserProfile{
		UserID:               userID,
		PenName:              input.PenName,
		Bio:                  input.Bio,
		UseDefaultAvatar:     input.UseDefaultAvatar,
		AvatarURL:            avatarURL,
		SNSLinks:             input.SNSLinks,
		HideFavoriteProjects: input.HideFavoriteProjects,
		HideFavoriteAuthors:  input.HideFavoriteAuthors,
	}
	if err := s.repo.CreateUserProfile(profile); err != nil {
		return nil, err
	}
	return userProfileOutput(profile), nil
}

func (s *Service) DeleteUserProfile(userID uint64) error {
	profile, err := s.repo.UserProfile(userID)
	if err != nil {
		if repository.IsRecordNotFound(err) {
			return nil
		}
		return err
	}
	return s.repo.DeleteUserProfile(profile)
}

func (s *Service) projectOutput(project *storytellerModel.Project, includeDraftStories bool) (*storytellerModel.ProjectOutput, error) {
	output := outputProject(*project)
	ratingCount, averageRating, err := s.repo.RankingSummary(project.ID)
	if err != nil {
		return nil, err
	}
	output.RatingCount = ratingCount
	output.AverageRating = averageRating
	var stories []storytellerModel.Story
	if includeDraftStories {
		stories, err = s.repo.Stories(project.ID)
	} else {
		stories, err = s.repo.PublishedStories(project.ID)
	}
	if err != nil {
		return nil, err
	}
	output.Stories = stories
	author, err := s.authorOutput(project.UserID)
	if err != nil {
		return nil, err
	}
	output.Author = author
	return output, nil
}

func (s *Service) authorOutput(userID uint64) (*storytellerModel.UserProfileOutput, error) {
	profile, err := s.repo.UserProfile(userID)
	if err != nil && !repository.IsRecordNotFound(err) {
		return nil, err
	}
	if err == nil {
		output := userProfileOutput(profile)
		if output.PenName != "" {
			return output, nil
		}
		output.PenName = fallbackAuthorName(userID)
		return output, nil
	}
	return &storytellerModel.UserProfileOutput{
		UserID:           userID,
		PenName:          fallbackAuthorName(userID),
		UseDefaultAvatar: true,
	}, nil
}

func (s *Service) favoriteAuthorOutput(userID uint64) (*storytellerModel.FavoriteAuthorOutput, error) {
	author, err := s.authorOutput(userID)
	if err != nil {
		return nil, err
	}
	projectCount, storyCount, wordCount, ratingCount, followerCount, averageRating, err := s.repo.PublicAuthorSummary(userID)
	if err != nil {
		return nil, err
	}
	return &storytellerModel.FavoriteAuthorOutput{
		UserProfileOutput: *author,
		ProjectCount:      projectCount,
		StoryCount:        storyCount,
		WordCount:         wordCount,
		RatingCount:       ratingCount,
		AverageRating:     averageRating,
		FollowerCount:     followerCount,
	}, nil
}

func (s *Service) storyForUserProject(userID uint64, projectPublicID, storyPublicID string) (*storytellerModel.Story, error) {
	project, err := s.repo.ProjectByPublicIDForUser(userID, projectPublicID)
	if err != nil {
		return nil, err
	}
	return s.repo.Story(project.ID, storyPublicID)
}

func (s *Service) loreForUserProject(userID uint64, projectPublicID, lorePublicID string) (*storytellerModel.Lore, error) {
	project, err := s.repo.ProjectByPublicIDForUser(userID, projectPublicID)
	if err != nil {
		return nil, err
	}
	return s.repo.Lore(project.ID, lorePublicID)
}

func (s *Service) projectOutputs(projects []storytellerModel.Project, includeDraftStories bool) ([]storytellerModel.ProjectOutput, error) {
	output := make([]storytellerModel.ProjectOutput, 0, len(projects))
	for _, project := range projects {
		row, err := s.projectOutput(&project, includeDraftStories)
		if err != nil {
			return nil, err
		}
		output = append(output, *row)
	}
	return output, nil
}

func outputProject(project storytellerModel.Project) *storytellerModel.ProjectOutput {
	return &storytellerModel.ProjectOutput{
		Project: project,
		TagList: decodeProjectTags(project.Tags),
	}
}

func defaultUserProfileOutput(userID uint64) *storytellerModel.UserProfileOutput {
	return &storytellerModel.UserProfileOutput{
		UserID:           userID,
		UseDefaultAvatar: true,
	}
}

func userProfileOutput(profile *storytellerModel.UserProfile) *storytellerModel.UserProfileOutput {
	return &storytellerModel.UserProfileOutput{
		UserID:               profile.UserID,
		PenName:              profile.PenName,
		Bio:                  profile.Bio,
		UseDefaultAvatar:     profile.UseDefaultAvatar,
		AvatarURL:            resolvedAvatarURL(profile.UserID, profile.AvatarURL),
		SNSLinks:             profile.SNSLinks,
		HideFavoriteProjects: profile.HideFavoriteProjects,
		HideFavoriteAuthors:  profile.HideFavoriteAuthors,
		CreatedAt:            profile.CreatedAt,
	}
}

// resolvedAvatarURL falls back to a Gravatar identicon when the profile has
// no avatar set at all (no custom URL, and the login provider has no photo
// either), so the public author page never has to show a bare placeholder icon.
func resolvedAvatarURL(userID uint64, avatarURL string) string {
	if avatarURL != "" {
		return avatarURL
	}
	return gravatarURL(userID)
}

func gravatarURL(userID uint64) string {
	user, err := authRepo.NewUserRepository().UserByID(userID)
	if err != nil || user.Email == nil {
		return ""
	}
	email := strings.ToLower(strings.TrimSpace(*user.Email))
	if email == "" {
		return ""
	}
	hash := md5.Sum([]byte(email))
	return fmt.Sprintf("https://www.gravatar.com/avatar/%x?d=identicon", hash)
}

func fallbackAuthorName(userID uint64) string {
	user, err := authRepo.NewUserRepository().UserByID(userID)
	if err != nil {
		return ""
	}
	if user.DisplayName != nil && strings.TrimSpace(*user.DisplayName) != "" {
		return strings.TrimSpace(*user.DisplayName)
	}
	if user.Email != nil && strings.TrimSpace(*user.Email) != "" {
		return strings.TrimSpace(*user.Email)
	}
	return ""
}

func loginAvatarURL(userID uint64) string {
	user, err := authRepo.NewUserRepository().UserByID(userID)
	if err != nil || user.PhotoURL == nil {
		return ""
	}
	return strings.TrimSpace(*user.PhotoURL)
}

// invalidPenNameCharsRegexp rejects characters that are structurally
// significant in a URL path segment (/storyteller/user/:username uses the
// pen name verbatim), plus raw control characters.
var invalidPenNameCharsRegexp = regexp.MustCompile(`[/\\?#%\x00-\x1F]`)

func validatePenName(penName string) error {
	if penName == "" {
		return errors.New("筆名不能是空白")
	}
	if invalidPenNameCharsRegexp.MatchString(penName) {
		return errors.New("筆名不能包含 / \\ ? # % 或控制字元")
	}
	return nil
}

// ensurePenNameAvailable rejects a pen name already claimed by a different
// user, since it doubles as the public profile URL segment and two users
// sharing one would silently shadow each other's page.
func (s *Service) ensurePenNameAvailable(userID uint64, penName string) error {
	existing, err := s.repo.UserProfileByPenName(penName)
	if err != nil {
		if repository.IsRecordNotFound(err) {
			return nil
		}
		return err
	}
	if existing.UserID != userID {
		return errors.New("這個筆名已經有人使用了，請換一個")
	}
	return nil
}

var snsDomainAllowlist = map[storytellerModel.SNSType][]string{
	storytellerModel.SNSTypeX:         {"x.com", "twitter.com"},
	storytellerModel.SNSTypeFacebook:  {"facebook.com", "fb.com"},
	storytellerModel.SNSTypeInstagram: {"instagram.com"},
	storytellerModel.SNSTypeThreads:   {"threads.net", "threads.com"},
	storytellerModel.SNSTypePlurk:     {"plurk.com"},
	storytellerModel.SNSTypeBahamut:   {"gamer.com.tw"},
	storytellerModel.SNSTypeDiscord:   {"discord.com", "discord.gg"},
	storytellerModel.SNSTypeYouTube:   {"youtube.com", "youtu.be"},
}

// validateSNSLinks only checks the well-known SNSType keys against their
// expected domains (e.g. catching an X handle pasted without x.com/twitter.com).
// Unrecognized keys are user-defined custom labels and are left unrestricted.
func validateSNSLinks(links storytellerModel.SNSLinks) error {
	for key, url := range links {
		domains, ok := snsDomainAllowlist[storytellerModel.SNSType(key)]
		if !ok {
			continue
		}
		lower := strings.ToLower(url)
		matched := false
		for _, domain := range domains {
			if strings.Contains(lower, domain) {
				matched = true
				break
			}
		}
		if !matched {
			return fmt.Errorf("%s 連結網址需包含 %s", key, strings.Join(domains, " 或 "))
		}
	}
	return nil
}

func buildStoryVersion(story storytellerModel.Story) *storytellerModel.StoryVersion {
	return &storytellerModel.StoryVersion{
		StoryID:   story.ID,
		Title:     story.Title,
		Summary:   story.Summary,
		Content:   story.LatestContent,
		WordCount: story.WordCount,
	}
}

func buildLoreVersion(lore storytellerModel.Lore) *storytellerModel.LoreVersion {
	return &storytellerModel.LoreVersion{
		LoreID:    lore.ID,
		Title:     lore.Title,
		Content:   lore.LatestContent,
		WordCount: lore.WordCount,
	}
}

// wordCount 只算段落實際會顯示給讀者看的文字：拿掉標題前綴、段落 marker（含 align/comment/
// commentColor 屬性）、行內樣式 delimiter，不然這些系統語法（尤其是 marker 裡兩個 36 碼的
// markerId UUID）會把字數嚴重灌水。邏輯對應前端 StoryEditor.tsx／LoreEditor.tsx 用
// parseMarkdownToParagraphs 取 runs 文字的字數公式，確保編輯中即時字數跟存檔後版本字數一致。
func wordCount(content string) uint {
	var builder strings.Builder
	for _, line := range strings.Split(content, "\n") {
		_, clean := splitHeadingAndMarkerContent(line)
		clean = stripStoryInlineMarkers(clean)
		builder.WriteString(stripInlineDelimiters(clean))
	}
	normalized := whitespaceRegexp.ReplaceAllString(builder.String(), "")
	return uint(len([]rune(normalized)))
}

func safeProjectSlug(name string) string {
	slug := unsafeSlugRegexp.ReplaceAllString(strings.TrimSpace(name), "_")
	slug = slugUnderscoreRegexp.ReplaceAllString(slug, "_")
	slug = strings.Trim(slug, "_")
	if slug == "" {
		return randomID()
	}
	return slug
}

func normalizeProjectRequest(input storytellerModel.ProjectRequest) storytellerModel.ProjectRequest {
	if input.Visibility == "" {
		input.Visibility = storytellerModel.ProjectVisibilityPrivate
	}
	if input.Rating == "" {
		input.Rating = storytellerModel.ProjectRatingGeneral
	}
	input.Tags = normalizeProjectTags(input.Tags)
	return input
}

func validateProject(input storytellerModel.ProjectRequest) error {
	if strings.TrimSpace(input.Name) == "" {
		return errors.New("name is required")
	}
	switch input.Visibility {
	case storytellerModel.ProjectVisibilityPublic, storytellerModel.ProjectVisibilityUnlisted, storytellerModel.ProjectVisibilityPrivate:
	default:
		return fmt.Errorf("invalid visibility")
	}
	switch input.Rating {
	case storytellerModel.ProjectRatingGeneral, storytellerModel.ProjectRatingGuidance, storytellerModel.ProjectRatingRestricted:
	default:
		return fmt.Errorf("invalid rating")
	}
	if len(input.Tags) > 12 {
		return fmt.Errorf("tags must contain 12 items or less")
	}
	for _, tag := range input.Tags {
		if len([]rune(tag)) > 24 {
			return fmt.Errorf("tag must be 24 characters or less")
		}
	}
	return nil
}

func normalizeProjectTags(tags []string) []string {
	seen := make(map[string]struct{}, len(tags))
	output := make([]string, 0, len(tags))
	for _, tag := range tags {
		value := strings.TrimSpace(tag)
		if value == "" {
			continue
		}
		if _, exists := seen[value]; exists {
			continue
		}
		seen[value] = struct{}{}
		output = append(output, value)
	}
	return output
}

func encodeProjectTags(tags []string) string {
	if len(tags) == 0 {
		return "[]"
	}
	raw, err := json.Marshal(tags)
	if err != nil {
		return "[]"
	}
	return string(raw)
}

func decodeProjectTags(raw string) []string {
	tags := make([]string, 0)
	if strings.TrimSpace(raw) == "" {
		return tags
	}
	if err := json.Unmarshal([]byte(raw), &tags); err != nil {
		return make([]string, 0)
	}
	return normalizeProjectTags(tags)
}

func normalizeStoryRequest(input storytellerModel.StoryRequest) storytellerModel.StoryRequest {
	if input.Status == "" {
		input.Status = storytellerModel.StoryStatusCompleted
	}
	return input
}

func normalizeAgentRequest(input storytellerModel.AgentRequest) storytellerModel.AgentRequest {
	if input.Provider == "" {
		input.Provider = storytellerModel.AgentProviderGrok
	}
	return input
}

func normalizeUserProfileRequest(input storytellerModel.UserProfileRequest) storytellerModel.UserProfileRequest {
	input.PenName = strings.TrimSpace(input.PenName)
	input.Bio = strings.TrimSpace(input.Bio)
	input.AvatarURL = strings.TrimSpace(input.AvatarURL)
	if input.UseDefaultAvatar {
		input.AvatarURL = ""
	}
	if input.SNSLinks != nil {
		links := make(storytellerModel.SNSLinks, len(input.SNSLinks))
		for key, value := range input.SNSLinks {
			key = strings.TrimSpace(key)
			value = strings.TrimSpace(value)
			if key == "" || value == "" {
				continue
			}
			links[key] = value
		}
		input.SNSLinks = links
	}
	return input
}

func (s *Service) validateAgent(input storytellerModel.AgentRequest, requireAPIKey bool) (*storytellerModel.AgentProviderModels, error) {
	if strings.TrimSpace(input.Name) == "" {
		return nil, errors.New("name is required")
	}
	provider, err := s.repo.AgentProviderModel(input.Provider, strings.TrimSpace(input.ModelName))
	if err != nil {
		return nil, errors.New("invalid provider")
	}
	if !provider.AllowCustomModel && len(provider.Models) == 0 {
		return nil, errors.New("invalid model_name")
	}
	if strings.TrimSpace(input.ModelName) == "" {
		return nil, errors.New("model_name is required")
	}
	if requireAPIKey && input.ProviderAPIKeyID == nil {
		return nil, errors.New("provider_apikey_id is required")
	}
	return provider, nil
}

func agentModelID(providerModel *storytellerModel.AgentProviderModels) *uint64 {
	if providerModel == nil || len(providerModel.Models) == 0 || providerModel.Models[0].ID == 0 {
		return nil
	}
	id := providerModel.Models[0].ID
	return &id
}

func validateAgentRunRequest(input storytellerModel.AgentRunRequest) error {
	if err := validateAgentRunPayloadSize(input); err != nil {
		return err
	}
	switch input.Mode {
	case storytellerModel.AgentRunModeRewriteSelection,
		storytellerModel.AgentRunModeExpandSelection,
		storytellerModel.AgentRunModeTranslateSelection,
		storytellerModel.AgentRunModeCustomSelection:
		return validateSelectionAgentRunRequest(input)
	case storytellerModel.AgentRunModeContinueChapter, storytellerModel.AgentRunModeCustomChapter:
		return nil
	default:
		return errors.New("invalid mode")
	}
}

const (
	agentRunInstructionMaxRunes     = 4000
	agentRunFullContentMaxRunes     = 60000
	agentRunSelectedContentMaxRunes = 20000
	agentRunTotalPayloadMaxRunes    = 80000
)

func validateAgentRunPayloadSize(input storytellerModel.AgentRunRequest) error {
	instructionLength := len([]rune(input.Instruction))
	fullContentLength := len([]rune(input.FullContent))
	selectedContentLength := len([]rune(input.SelectedContent))
	if instructionLength > agentRunInstructionMaxRunes {
		return fmt.Errorf("instruction must be %d characters or less", agentRunInstructionMaxRunes)
	}
	if fullContentLength > agentRunFullContentMaxRunes {
		return fmt.Errorf("full_content must be %d characters or less", agentRunFullContentMaxRunes)
	}
	if selectedContentLength > agentRunSelectedContentMaxRunes {
		return fmt.Errorf("selected_content must be %d characters or less", agentRunSelectedContentMaxRunes)
	}
	if instructionLength+fullContentLength+selectedContentLength > agentRunTotalPayloadMaxRunes {
		return fmt.Errorf("agent run payload must be %d characters or less", agentRunTotalPayloadMaxRunes)
	}
	return nil
}

func buildAgentRunPrompts(agent storytellerModel.Agent, input storytellerModel.AgentRunRequest) (string, string) {
	systemPrompt := strings.TrimSpace(`You are Storyteller's writing assistant. Help the user process story text.

Rules:
- Follow the purpose, tone, and constraints configured for this Agent.
- Unless the user asks for analysis, output content that can be placed directly back into the story.
- Do not include unrelated prefaces, conclusions, or explanations.
- Do not store, disclose, or request sensitive information.

Agent default configuration:
` + strings.TrimSpace(agent.DefaultPrompt))

	sections := []string{
		"Task mode:\n" + string(input.Mode),
		"User instruction:\n" + agentRunPromptInstruction(input.Instruction),
	}
	if !agentRunModeRequiresSelection(input.Mode) && strings.TrimSpace(input.FullContent) != "" {
		sections = append(sections, "Current chapter full content:\n<<<STORY_FULL_CONTENT\n"+input.FullContent+"\nSTORY_FULL_CONTENT")
	}
	if agentRunModeRequiresSelection(input.Mode) {
		sections = append(sections, "Current selected text:\n<<<STORY_SELECTED_CONTENT\n"+input.SelectedContent+"\nSTORY_SELECTED_CONTENT")
	}
	sections = append(sections, "Output requirements:\n"+agentRunOutputInstruction(input.Mode))
	return systemPrompt, strings.Join(sections, "\n\n")
}

func agentRunPromptInstruction(instruction string) string {
	value := strings.TrimSpace(instruction)
	if value == "" {
		return "(No additional instruction was provided.)"
	}
	return value
}

func buildAgentRunChat(userID, storyID uint64, agent storytellerModel.Agent, input storytellerModel.AgentRunRequest, output *storytellerModel.AgentRunResponse) (*storytellerModel.StoryChat, []storytellerModel.StoryChatMessage) {
	chat := &storytellerModel.StoryChat{
		StoryID: &storyID,
		AgentID: agent.ID,
		UserID:  userID,
	}
	return chat, buildAgentRunMessages(agent, input, output)
}

func buildLoreAgentRunChat(userID, loreID uint64, agent storytellerModel.Agent, input storytellerModel.AgentRunRequest, output *storytellerModel.AgentRunResponse) (*storytellerModel.StoryChat, []storytellerModel.StoryChatMessage) {
	chat := &storytellerModel.StoryChat{
		LoreID:  &loreID,
		AgentID: agent.ID,
		UserID:  userID,
	}
	return chat, buildAgentRunMessages(agent, input, output)
}

func buildAgentRunMessages(agent storytellerModel.Agent, input storytellerModel.AgentRunRequest, output *storytellerModel.AgentRunResponse) []storytellerModel.StoryChatMessage {
	agentID := agent.ID
	return []storytellerModel.StoryChatMessage{
		{
			AgentID:  &agentID,
			Role:     storytellerModel.ChatMessageRoleUser,
			Content:  agentRunUserMessageContent(input),
			Metadata: agentRunInputMetadata(input),
		},
		{
			AgentID:  &agentID,
			Role:     storytellerModel.ChatMessageRoleAssistant,
			Content:  output.Result,
			Metadata: agentRunOutputMetadata(output),
		},
	}
}

func agentRunUserMessageContent(input storytellerModel.AgentRunRequest) string {
	instruction := strings.TrimSpace(input.Instruction)
	selected := strings.TrimSpace(input.SelectedContent)
	if selected == "" {
		return instruction
	}
	quoted := strings.ReplaceAll(selected, "\n", "\n> ")
	if instruction == "" {
		return "> " + quoted
	}
	return "> " + quoted + "\n\n" + instruction
}

func agentRunInputMetadata(input storytellerModel.AgentRunRequest) string {
	value := fmt.Sprintf(`{"mode":%q`, input.Mode)
	if input.SelectionStart != nil && input.SelectionEnd != nil {
		value += fmt.Sprintf(`,"selection_start":%d,"selection_end":%d`, *input.SelectionStart, *input.SelectionEnd)
	}
	if input.SelectedContent != "" {
		value += fmt.Sprintf(`,"selected_content_length":%d`, len([]rune(input.SelectedContent)))
	}
	value += fmt.Sprintf(`,"full_content_length":%d`, len([]rune(input.FullContent)))
	return value + "}"
}

func agentRunOutputMetadata(output *storytellerModel.AgentRunResponse) string {
	if output == nil || output.Usage == nil {
		if output != nil && output.FinishReason != "" {
			return fmt.Sprintf(`{"finish_reason":%q}`, output.FinishReason)
		}
		return "{}"
	}
	return fmt.Sprintf(
		`{"finish_reason":%q,"usage":{"input_tokens":%d,"output_tokens":%d,"total_tokens":%d}}`,
		output.FinishReason,
		output.Usage.InputTokens,
		output.Usage.OutputTokens,
		output.Usage.TotalTokens,
	)
}

func agentRunModeRequiresSelection(mode storytellerModel.AgentRunMode) bool {
	switch mode {
	case storytellerModel.AgentRunModeRewriteSelection,
		storytellerModel.AgentRunModeExpandSelection,
		storytellerModel.AgentRunModeTranslateSelection,
		storytellerModel.AgentRunModeCustomSelection:
		return true
	default:
		return false
	}
}

func agentRunOutputInstruction(mode storytellerModel.AgentRunMode) string {
	switch mode {
	case storytellerModel.AgentRunModeRewriteSelection:
		return "Only output the rewritten text. Do not list versions or explain changes. Preserve the original tone and Markdown structure."
	case storytellerModel.AgentRunModeExpandSelection:
		return "Only output the expanded text. Do not explain changes. Continue the original tone and point of view."
	case storytellerModel.AgentRunModeTranslateSelection:
		return "Only output the translated text without notes. Infer the target language from the user instruction; if unspecified, translate to Traditional Chinese."
	case storytellerModel.AgentRunModeContinueChapter:
		return "Only output new content that can continue after the current chapter ending. Do not repeat the full chapter."
	case storytellerModel.AgentRunModeCustomSelection:
		return "Follow the user instruction. If analysis is not requested, output text that can be directly applied to the story."
	case storytellerModel.AgentRunModeCustomChapter:
		return "Follow the user instruction. If rewriting or continuing, do not repeat the entire chapter."
	default:
		return "Follow the user instruction."
	}
}

func validateSelectionAgentRunRequest(input storytellerModel.AgentRunRequest) error {
	if strings.TrimSpace(input.SelectedContent) == "" {
		return errors.New("selected_content is required")
	}
	if input.SelectionStart == nil {
		return errors.New("selection_start is required")
	}
	if input.SelectionEnd == nil {
		return errors.New("selection_end is required")
	}
	if *input.SelectionStart < 0 {
		return errors.New("selection_start must be greater than or equal to 0")
	}
	if *input.SelectionEnd <= *input.SelectionStart {
		return errors.New("selection_end must be greater than selection_start")
	}
	return nil
}

func validateStory(input storytellerModel.StoryRequest) error {
	if strings.TrimSpace(input.Title) == "" {
		return errors.New("title is required")
	}
	switch input.Status {
	case storytellerModel.StoryStatusDraft, storytellerModel.StoryStatusCompleted:
	default:
		return fmt.Errorf("invalid status")
	}
	return nil
}

func validateLore(input storytellerModel.LoreRequest) error {
	if strings.TrimSpace(input.Title) == "" {
		return errors.New("title is required")
	}
	return nil
}

func randomID() string {
	buf := make([]byte, 8)
	if _, err := rand.Read(buf); err != nil {
		return ""
	}
	return hex.EncodeToString(buf)
}
