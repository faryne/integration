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
	"sort"
	"strconv"
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
var storytellerReferenceRegexp = regexp.MustCompile(`@(thisStory|thisLore|story:|lore:)`)

type Service struct {
	repo *storytellerRepo.Repository
}

type agentRunRepository interface {
	ProjectByPublicIDForUser(userID uint64, publicID string) (*storytellerModel.Project, error)
	Story(projectID uint64, publicID string) (*storytellerModel.Story, error)
	Lore(projectID uint64, publicID string) (*storytellerModel.Lore, error)
	Agent(userID, id uint64) (*storytellerModel.Agent, error)
	AgentsByIDs(userID uint64, ids []uint64) ([]storytellerModel.Agent, error)
	ProviderAPIKey(userID, id uint64) (*storytellerModel.ProviderAPIKey, error)
	CreateStoryChatWithMessages(chat *storytellerModel.StoryChat, messages []storytellerModel.StoryChatMessage, proposals []storytellerModel.AgentProposal, usage *storytellerModel.AgentUsageLog) error
	AgentProposalByPublicIDForUser(userID uint64, publicID string) (*storytellerModel.AgentProposal, error)
	UpdateAgentProposalStatus(id uint64, status storytellerModel.AgentProposalStatus, appliedAt *time.Time) (int64, error)
	ResetAppliedAgentProposalToPending(id uint64) (int64, error)
	RecentStoryAgenticMessages(storyID uint64, limit int) ([]storytellerModel.StoryChatMessage, error)
	RecentLoreAgenticMessages(loreID uint64, limit int) ([]storytellerModel.StoryChatMessage, error)
	CreateInProgressChatWithUserMessage(chat *storytellerModel.StoryChat, userMessage *storytellerModel.StoryChatMessage) error
	CompleteChatMessage(chatID uint64, assistantMessage *storytellerModel.StoryChatMessage, proposals []storytellerModel.AgentProposal, usage *storytellerModel.AgentUsageLog) error
	ClaimStoryChatForResend(userID, storyID, chatID uint64) (int64, error)
	ClaimLoreChatForResend(userID, loreID, chatID uint64) (int64, error)
	ReleaseChatToPending(chatID uint64) error
	ChatUserMessage(chatID uint64) (*storytellerModel.StoryChatMessage, error)
	StoryChatMessageByIDForUserStory(userID, storyID, messageID uint64) (*storytellerModel.StoryChatMessage, error)
	LoreChatMessageByIDForUserLore(userID, loreID, messageID uint64) (*storytellerModel.StoryChatMessage, error)
	AgentProposalByPublicIDForUserProject(userID, projectID uint64, publicID string) (*storytellerModel.AgentProposal, error)
	// AgentModelPrice 回傳固定模型清單供應商（allow_custom_model=0）某個 model
	// 目前的單價（每 token 美金，JSON 字串），找不到（self_hosted／openrouter
	// 自訂 model 名稱，或該 model 沒有價格資料）回傳 nil、不報錯——usage log
	// 寫入時只是拿這個值當「當下」快照，查不到就記不到成本，不影響主流程。
	AgentModelPrice(provider storytellerModel.AgentProvider, modelName string) (*string, error)
}

type aiProviderFactory func(provider storytellerModel.AgentProvider, endpoint string) (AIProvider, error)

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

// PublicProject 是故事閱讀頁用的主要專案讀取——viewerID 是可選的（見 controller 的
// optionalViewerID），用來讓專案本人即使在瀏覽私人／不公開連結的專案時，這條公開路由
// 也不會 404；一般訪客（viewerID=0 或非本人）行為不變。
//
// 草稿故事只有在專案「不是真正公開」時才連本人一起顯示：私人／不公開連結專案本來就
// 沒有外部訪客看得到這條路由（要嘛整個私有、要嘛得先透過分享連結），本人從這裡看到
// 等同單純的個人預覽，維持顯示草稿沒問題。但專案一旦是 public，這條路由就是「讀者
// 實際看到的樣子」——本人如果也連草稿一起看到，會誤以為草稿故事外洩到公開閱讀頁，
// 所以公開專案一律排除草稿，跟訪客看到的一致；本人要看/管草稿請回工作台。
func (s *Service) PublicProject(projectValue string, viewerID uint64) (*storytellerModel.ProjectOutput, error) {
	publicID := publicProjectIDFromPath(projectValue)
	project, err := s.repo.ProjectByPublicIDForPublicReader(viewerID, publicID)
	if err != nil {
		return nil, err
	}
	isOwner := viewerID != 0 && project.UserID == viewerID
	includeDraftStories := isOwner && project.Visibility != storytellerModel.ProjectVisibilityPublic
	output, err := s.projectOutputWithFollowerCount(project, includeDraftStories)
	if err != nil {
		return nil, err
	}
	return output, s.signProjectOutputAssetURIs(project.ID, output)
}

func (s *Service) SharedProject(token string) (*storytellerModel.ProjectOutput, error) {
	project, err := s.repo.ProjectByShareToken(strings.TrimSpace(token))
	if err != nil {
		return nil, err
	}
	output, err := s.projectOutputWithFollowerCount(project, false)
	if err != nil {
		return nil, err
	}
	return output, s.signProjectOutputAssetURIs(project.ID, output)
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
	output, err := s.projectOutputWithFollowerCount(project, true)
	if err != nil {
		return nil, err
	}
	loreTotal, loreUncategorized, err := s.repo.LoreProjectCounts(project.ID)
	if err != nil {
		return nil, err
	}
	assetTotal, assetUncategorized, err := s.repo.AssetProjectCounts(project.ID)
	if err != nil {
		return nil, err
	}
	output.LoreCount = uint64(loreTotal)
	output.LoreUncategorizedCount = uint64(loreUncategorized)
	output.AssetCount = uint64(assetTotal)
	output.AssetUncategorizedCount = uint64(assetUncategorized)
	return output, nil
}

func publicProjectIDFromPath(projectValue string) string {
	return strings.SplitN(strings.TrimSpace(projectValue), "-", 2)[0]
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
		ContentType: input.ContentType,
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
	project.ContentType = input.ContentType
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
	s.resyncProjectSearchIndex(project)
	return s.projectOutput(project, true)
}

func (s *Service) DeleteProject(userID uint64, publicID string) error {
	project, err := s.repo.ProjectByPublicIDForUser(userID, publicID)
	if err != nil {
		return err
	}
	if err := s.repo.DeleteProject(project); err != nil {
		return err
	}
	s.removeProjectSearchIndex(project.PublicID)
	return nil
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
	providerModel, err := s.validateAgent(input, true)
	if err != nil {
		return nil, err
	}
	if err := s.validateAgentProviderAPIKey(userID, input); err != nil {
		return nil, err
	}
	agent := &storytellerModel.Agent{
		UserID:           userID,
		Name:             normalizeAgentName(input.Name),
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
	agent.Name = normalizeAgentName(input.Name)
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
		Endpoint: strings.TrimSpace(input.Endpoint),
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
	if row.Provider == storytellerModel.AgentProviderSelfHosted {
		if strings.TrimSpace(input.Endpoint) == "" {
			return nil, errors.New("endpoint is required for self-hosted provider")
		}
		row.Endpoint = strings.TrimSpace(input.Endpoint)
	}
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

func (s *Service) TestProviderAPIKey(ctx context.Context, userID, id uint64, modelNameOverride string) error {
	key, err := s.repo.ProviderAPIKey(userID, id)
	if err != nil {
		return err
	}
	providerModels, err := s.repo.AgentProviderModels()
	if err != nil {
		return err
	}
	modelName := strings.TrimSpace(modelNameOverride)
	allowCustomModel := false
	for _, providerModel := range providerModels {
		if providerModel.Provider != key.Provider {
			continue
		}
		allowCustomModel = providerModel.AllowCustomModel
		if modelName == "" && len(providerModel.Models) > 0 {
			modelName = providerModel.Models[0].Name
		}
		break
	}
	if modelName == "" {
		if allowCustomModel {
			return errors.New("model_name is required to test this provider")
		}
		return errors.New("no model configured for this provider yet")
	}
	provider, err := NewAIProvider(key.Provider, key.Endpoint)
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

func (s *Service) AgentUsageLogs(userID, providerAPIKeyID uint64, storyID, loreID *uint64, month string, page, pageSize int) ([]storytellerModel.AgentUsageLogRow, int64, error) {
	from, to, err := parseUsageMonth(month)
	if err != nil {
		return nil, 0, err
	}
	// 確認這把 Key 屬於呼叫者本人，避免用別人的 id 猜出用量明細；story_id／lore_id
	// 不用另外查權限——底下查詢本來就已經用 logs.user_id 篩過，帶不屬於自己的
	// story/lore id 只會查到空結果，不會洩漏別人的資料。
	if _, err := s.repo.ProviderAPIKey(userID, providerAPIKeyID); err != nil {
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
	return s.repo.AgentUsageLogs(userID, providerAPIKeyID, storyID, loreID, from, to, (page-1)*pageSize, pageSize)
}

func (s *Service) validateProviderAPIKeyRequest(input storytellerModel.ProviderAPIKeyRequest) error {
	if strings.TrimSpace(input.APIKey) == "" {
		return errors.New("api_key is required")
	}
	if input.Provider == storytellerModel.AgentProviderSelfHosted && strings.TrimSpace(input.Endpoint) == "" {
		return errors.New("endpoint is required for self-hosted provider")
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
		Endpoint:     row.Endpoint,
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
	return runLoreAgent(ctx, s.repo, NewAIProvider, nil, userID, projectPublicID, lorePublicID, agentID, input)
}

type agentRunTarget struct {
	Kind     agenticQueryCurrentTargetKind
	ID       uint64
	PublicID string
	Title    string
}

type agentRunTargetLookup func(projectID uint64, publicID string) (agentRunTarget, error)

const (
	agentRunLoopMaxSteps    = 3
	agentRunLoopMaxDuration = 2 * time.Minute
)

func runLoreAgent(ctx context.Context, repo agentRunRepository, providerFactory aiProviderFactory, readOnlyTools []ToolSpec, userID uint64, projectPublicID, lorePublicID string, agentID uint64, input storytellerModel.AgentRunRequest) (*storytellerModel.AgentRunResponse, error) {
	return runAgentForTarget(ctx, repo, providerFactory, readOnlyTools, userID, projectPublicID, lorePublicID, agentID, input, func(projectID uint64, publicID string) (agentRunTarget, error) {
		lore, err := repo.Lore(projectID, publicID)
		if err != nil {
			return agentRunTarget{}, err
		}
		return agentRunTarget{Kind: agenticQueryCurrentTargetLore, ID: lore.ID, PublicID: lore.PublicID, Title: lore.Title}, nil
	})
}

func runAgent(ctx context.Context, repo agentRunRepository, providerFactory aiProviderFactory, userID uint64, projectPublicID, storyPublicID string, agentID uint64, input storytellerModel.AgentRunRequest) (*storytellerModel.AgentRunResponse, error) {
	return runAgentWithTools(ctx, repo, providerFactory, nil, userID, projectPublicID, storyPublicID, agentID, input)
}

func runAgentWithTools(ctx context.Context, repo agentRunRepository, providerFactory aiProviderFactory, readOnlyTools []ToolSpec, userID uint64, projectPublicID, storyPublicID string, agentID uint64, input storytellerModel.AgentRunRequest) (*storytellerModel.AgentRunResponse, error) {
	return runAgentForTarget(ctx, repo, providerFactory, readOnlyTools, userID, projectPublicID, storyPublicID, agentID, input, func(projectID uint64, publicID string) (agentRunTarget, error) {
		story, err := repo.Story(projectID, publicID)
		if err != nil {
			return agentRunTarget{}, err
		}
		return agentRunTarget{Kind: agenticQueryCurrentTargetStory, ID: story.ID, PublicID: story.PublicID, Title: story.Title}, nil
	})
}

func runAgentForTarget(ctx context.Context, repo agentRunRepository, providerFactory aiProviderFactory, readOnlyTools []ToolSpec, userID uint64, projectPublicID, targetPublicID string, agentID uint64, input storytellerModel.AgentRunRequest, lookupTarget agentRunTargetLookup) (*storytellerModel.AgentRunResponse, error) {
	if err := validateAgentRunRequest(input); err != nil {
		return nil, err
	}
	project, err := repo.ProjectByPublicIDForUser(userID, projectPublicID)
	if err != nil {
		return nil, err
	}
	target, err := lookupTarget(project.ID, targetPublicID)
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
	// provider／modelName 用「這次實際解析出來的」，不是 Agent 記錄的靜態預設——
	// key 覆寫時 providerAPIKeyRow.Provider 可能跟 agent.Provider 不同。
	modelName := resolveAgentModelName(agent, input.ModelName)
	if strings.TrimSpace(modelName) == "" {
		return nil, errAgentModelNameNotConfigured
	}
	provider, err := providerFactory(providerAPIKeyRow.Provider, providerAPIKeyRow.Endpoint)
	if err != nil {
		return nil, err
	}
	apiKey, err := decryptProviderAPIKey(providerAPIKeyRow)
	if err != nil {
		return nil, err
	}
	useLoop := agentRunShouldUseLoop(providerAPIKeyRow.Provider, input)
	systemPrompt, userPrompt := buildAgentRunPrompts(*agent, input, projectPublicID, target, useLoop)
	result, err := executeAgentRun(ctx, provider, apiKey, modelName, systemPrompt, userPrompt, projectPublicID, readOnlyTools, useLoop, userID)
	if err != nil {
		return nil, err
	}
	output := &storytellerModel.AgentRunResponse{
		AgentID:      agent.ID,
		Provider:     providerAPIKeyRow.Provider,
		ModelName:    modelName,
		Mode:         input.Mode,
		Result:       result.Text,
		FinishReason: result.FinishReason,
	}
	if result.Usage != nil {
		output.Usage = &storytellerModel.AgentRunUsage{
			InputTokens:  result.Usage.InputTokens,
			OutputTokens: result.Usage.OutputTokens,
			TotalTokens:  result.Usage.TotalTokens,
		}
	}
	var chat *storytellerModel.StoryChat
	var messages []storytellerModel.StoryChatMessage
	if target.Kind == agenticQueryCurrentTargetLore {
		chat, messages = buildLoreAgentRunChat(userID, target.ID, *agent, input, output, result.RawResponses)
	} else {
		chat, messages = buildAgentRunChat(userID, target.ID, *agent, input, output, result.RawResponses)
	}
	usage := buildAgentUsageLog(repo, userID, providerAPIKeyRow.ID, output)
	if err := repo.CreateStoryChatWithMessages(chat, messages, nil, usage); err != nil {
		return nil, err
	}
	output.UserMessageID = messages[0].ID
	output.AssistantMessageID = messages[1].ID
	return output, nil
}

type agentRunExecutionResult struct {
	Text         string
	FinishReason string
	Usage        *AIProviderUsage
	RawResponses []string
}

func executeAgentRun(ctx context.Context, provider AIProvider, apiKey, modelName, systemPrompt, userPrompt, projectPublicID string, readOnlyTools []ToolSpec, useLoop bool, userID uint64) (*agentRunExecutionResult, error) {
	if !useLoop {
		response, err := provider.Generate(ctx, AIProviderRequest{
			APIKey:       apiKey,
			ModelName:    modelName,
			SystemPrompt: systemPrompt,
			UserPrompt:   userPrompt,
		})
		if err != nil {
			return nil, err
		}
		return &agentRunExecutionResult{
			Text:         response.Result,
			FinishReason: response.FinishReason,
			Usage:        response.Usage,
			RawResponses: nonEmptyRawResponses(response.RawBody),
		}, nil
	}

	ctx = WithStorytellerUserID(ctx, userID)
	ctx = WithStorytellerSource(ctx, "agent_skill")
	loopResult, err := RunAgentLoop(ctx, AgentLoopRequest{
		Provider:     provider,
		APIKey:       apiKey,
		ModelName:    modelName,
		SystemPrompt: systemPrompt,
		History:      nil,
		UserPrompt:   userPrompt,
		Tools:        ScopeToolsToProject(agentRunReadOnlyTools(readOnlyTools), projectPublicID),
		MaxSteps:     agentRunLoopMaxSteps,
		MaxDuration:  agentRunLoopMaxDuration,
	})
	if err != nil {
		return nil, agentRunLoopUserError(err)
	}
	if loopResult == nil {
		return nil, errors.New("AI 沒有產生可用結果，請稍後重試")
	}
	return &agentRunExecutionResult{
		Text:         loopResult.FinalText,
		FinishReason: loopResult.FinishReason,
		Usage:        loopResult.Usage,
		RawResponses: loopResult.RawResponses,
	}, nil
}

func nonEmptyRawResponses(raw string) []string {
	if raw == "" {
		return nil
	}
	return []string{raw}
}

func agentRunReadOnlyTools(tools []ToolSpec) []ToolSpec {
	if tools == nil {
		tools = ReadOnlyStorytellerTools()
	}
	out := make([]ToolSpec, 0, len(tools))
	for _, spec := range tools {
		if spec.Name == "storyteller_list_projects" {
			continue
		}
		if strings.HasPrefix(spec.Name, "storyteller_get_") || strings.HasPrefix(spec.Name, "storyteller_list_") {
			out = append(out, spec)
		}
	}
	return out
}

func agentRunLoopUserError(err error) error {
	if errors.Is(err, ErrAgentLoopMaxStepsExceeded) {
		return errors.New("AI 查詢引用資料的步驟超過上限，這次 skill 沒有產生可用結果；請縮小引用範圍或重試")
	}
	if errors.Is(err, context.DeadlineExceeded) {
		return errors.New("AI 查詢引用資料逾時，這次 skill 沒有產生可用結果；請稍後重試或縮小引用範圍")
	}
	return err
}

func agentRunShouldUseLoop(provider storytellerModel.AgentProvider, input storytellerModel.AgentRunRequest) bool {
	if provider == storytellerModel.AgentProviderGemini {
		return false
	}
	return storytellerReferenceRegexp.MatchString(input.Instruction) || storytellerReferenceRegexp.MatchString(input.FullContent)
}

var (
	errAgentProviderAPIKeyNotConfigured = errors.New("agent has no provider api key configured")
	errAgentProviderAPIKeyMismatch      = errors.New("provider api key does not match agent provider")
	// errAgentModelNameNotConfigured：Agent 跟 provider/model 剝離之後，人設本身
	// 可能完全沒有記錄預設 model；呼叫端（單輪 skill／AI 助理的 model chip）沒有
	// 額外指定 model 時，與其把空字串送進 AI provider 換一個難懂的原始錯誤，不如
	// 在這裡就擋下來給明確訊息。
	errAgentModelNameNotConfigured = errors.New("agent has no default model configured; please select a model")
)

// resolveAgentProviderAPIKey 解析這次呼叫實際要用哪把 key。Agent 本身的
// prompt／人設跟「預設用哪把 key」是分開的兩件事——沒有 overrideID 時沿用
// Agent 綁定的預設 key（這條路徑維持舊行為，要求 key 的 provider 跟 Agent 記錄的
// provider 一致，理論上這兩者本來就該一致，這裡只是防呆）；呼叫端明確帶了
// overrideID 時，代表「這次就是要用另一把 key 執行」，可能連 provider 都不同
// （例如這個 Agent 原本設定成 Claude，這次想試試看用 OpenAI 的 key 跑同一份
// prompt），這種情況故意不擋，呼叫端要自己決定要用哪把 key 的 Provider／
// ModelName（見 runAgent／runStoryAgenticQuery 改用 key 本身的 Provider，不是
// Agent 記錄的 Provider）。
func resolveAgentProviderAPIKey(lookup func(userID, id uint64) (*storytellerModel.ProviderAPIKey, error), userID uint64, agent *storytellerModel.Agent, overrideID *uint64) (*storytellerModel.ProviderAPIKey, error) {
	keyID := agent.ProviderAPIKeyID
	overridden := overrideID != nil
	if overridden {
		keyID = overrideID
	}
	if keyID == nil {
		return nil, errAgentProviderAPIKeyNotConfigured
	}
	key, err := lookup(userID, *keyID)
	if err != nil {
		return nil, err
	}
	if !overridden && key.Provider != agent.Provider {
		return nil, errAgentProviderAPIKeyMismatch
	}
	return key, nil
}

// buildAgentUsageLog 記錄這次執行「實際解析後」使用的 apikey_id，
// 不論它來自 request 的單次覆寫還是 Agent 的預設設定；沒有 usage 資訊時不寫入紀錄。
// Price 是寫入當下查一次 AgentModelPrice 存的快照，之後價目表怎麼變動都不會
// 回頭影響這筆歷史紀錄（見 AgentUsageLog.Price 的說明）；查價格失敗（找不到、
// self_hosted／openrouter 自訂名稱）不擋主流程，Price 留 nil 就好。
func buildAgentUsageLog(repo agentRunRepository, userID, providerAPIKeyID uint64, output *storytellerModel.AgentRunResponse) *storytellerModel.AgentUsageLog {
	if output == nil || output.Usage == nil {
		return nil
	}
	price, _ := repo.AgentModelPrice(output.Provider, output.ModelName)
	return &storytellerModel.AgentUsageLog{
		UserID:           userID,
		ProviderAPIKeyID: providerAPIKeyID,
		// Provider／ModelName 記錄的是這次「實際」用了哪家／哪個 model（來自
		// output，已經套用過 key／model 覆寫的解析結果），不是 Agent 記錄的
		// 靜態預設值——Agent 跟 provider/key/model 剝離之後，這兩者不一定相同。
		Provider:     output.Provider,
		ModelName:    output.ModelName,
		Price:        price,
		InputTokens:  output.Usage.InputTokens,
		OutputTokens: output.Usage.OutputTokens,
		TotalTokens:  output.Usage.TotalTokens,
	}
}

// resolveAgentModelName 留空 override 時沿用 Agent 記錄的預設 model，帶值時這次
// 呼叫改用這個 model 名稱——跟 resolveAgentProviderAPIKey 是各自獨立的覆寫。
func resolveAgentModelName(agent *storytellerModel.Agent, override string) string {
	if strings.TrimSpace(override) != "" {
		return strings.TrimSpace(override)
	}
	return agent.ModelName
}

func (s *Service) Stories(userID uint64, projectPublicID string) ([]storytellerModel.Story, error) {
	project, err := s.repo.ProjectByPublicIDForUser(userID, projectPublicID)
	if err != nil {
		return nil, err
	}
	return s.repo.Stories(project.ID)
}

// StoriesPage 給 MCP 這種需要控制單次回應大小的呼叫端用，語意跟 StoryChatMessages
// 的分頁一樣：page 從 1 起算，pageSize 預設 20、上限 100。
func (s *Service) StoriesPage(userID uint64, projectPublicID string, page, pageSize int) ([]storytellerModel.Story, int64, error) {
	if page < 1 {
		page = 1
	}
	if pageSize < 1 {
		pageSize = 20
	}
	if pageSize > 100 {
		pageSize = 100
	}
	project, err := s.repo.ProjectByPublicIDForUser(userID, projectPublicID)
	if err != nil {
		return nil, 0, err
	}
	return s.repo.StoriesPage(project.ID, (page-1)*pageSize, pageSize)
}

func (s *Service) Story(userID uint64, projectPublicID, storyPublicID string) (*storytellerModel.Story, error) {
	project, err := s.repo.ProjectByPublicIDForUser(userID, projectPublicID)
	if err != nil {
		return nil, err
	}
	return s.repo.Story(project.ID, storyPublicID)
}

func (s *Service) CreateStory(userID uint64, projectPublicID string, input storytellerModel.StoryRequest, source string) (*storytellerModel.Story, error) {
	input = normalizeStoryRequest(input)
	if err := validateStory(input); err != nil {
		return nil, err
	}
	project, err := s.repo.ProjectByPublicIDForUser(userID, projectPublicID)
	if err != nil {
		return nil, err
	}
	if input.ContentType == storytellerModel.ProjectContentTypeImage {
		input.Content, err = s.normalizeImageStoryContent(project.ID, input.Content)
		if err != nil {
			return nil, err
		}
	} else if err := s.validateMarkdownAssetReferences(project.ID, input.Content); err != nil {
		return nil, err
	} else {
		input.Content = backfillStoryMarkerIds(input.Content)
	}
	parent, err := s.resolveVolumeParent(project.ID, input.ParentID)
	if err != nil {
		return nil, err
	}
	story := &storytellerModel.Story{
		PublicID:      randomID(),
		ProjectID:     project.ID,
		ParentID:      parentID(parent),
		ContentType:   input.ContentType,
		Title:         strings.TrimSpace(input.Title),
		Summary:       strings.TrimSpace(input.Summary),
		Status:        input.Status,
		Sort:          input.Sort,
		LatestContent: input.Content,
		WordCount:     storyWordCount(input.ContentType, input.Content),
	}
	version := buildStoryVersion(*story, source)
	volumeEvent := volumeMoveEvent(nil, story.ParentID)
	if err := s.repo.CreateStoryWithVersion(story, version, volumeEvent); err != nil {
		return nil, err
	}
	if story.ContentType == storytellerModel.ProjectContentTypeImage {
		if err := s.syncImageStoryAssetReferences(project.ID, story); err != nil {
			return nil, err
		}
	} else if err := s.syncMarkdownAssetReferences(project.ID, assetReferenceTargetStory, story.ID, story.LatestVersionID, story.LatestContent); err != nil {
		return nil, err
	}
	s.syncStorySearchIndex(project, story)
	return story, nil
}

// UpdateStory 存檔並塞入新版本；回傳的 conflicted 只是「這次存檔的 base_version_id
// 已經不是最新版本」的提示旗標，不會拒絕寫入，內容照樣存成新版本。冊只能透過
// CreateVolume／UpdateVolume 編輯，這個一般故事的更新入口會擋下 is_volume=true 的故事。
func (s *Service) UpdateStory(userID uint64, projectPublicID, storyPublicID string, input storytellerModel.StoryRequest, source string) (story *storytellerModel.Story, conflicted bool, err error) {
	input = normalizeStoryRequest(input)
	if err := validateStory(input); err != nil {
		return nil, false, err
	}
	project, err := s.repo.ProjectByPublicIDForUser(userID, projectPublicID)
	if err != nil {
		return nil, false, err
	}
	story, err = s.repo.Story(project.ID, storyPublicID)
	if err != nil {
		return nil, false, err
	}
	if story.IsVolume {
		return nil, false, errors.New("cannot edit a volume through the story endpoint")
	}
	if story.ContentType == storytellerModel.ProjectContentTypeImage {
		input.Content, err = s.normalizeImageStoryContent(project.ID, input.Content)
		if err != nil {
			return nil, false, err
		}
	} else if err := s.validateMarkdownAssetReferences(project.ID, input.Content); err != nil {
		return nil, false, err
	} else {
		input.Content = backfillStoryMarkerIds(input.Content)
	}
	// ParentID == nil 代表這次存檔沒有要動冊隸屬（例如狀態切換、拖曳排序、一般編輯頁存檔），
	// 維持故事目前的 parent_id 不動；只有明確帶了 parent_id（含空字串代表移出冊）才處理。
	var volumeEvent *storytellerModel.StoryVolumeEvent
	if input.ParentID != nil {
		parent, err := s.resolveVolumeParent(project.ID, input.ParentID)
		if err != nil {
			return nil, false, err
		}
		previousParentID := story.ParentID
		story.ParentID = parentID(parent)
		volumeEvent = volumeMoveEvent(previousParentID, story.ParentID)
	}
	story.Title = strings.TrimSpace(input.Title)
	story.Summary = strings.TrimSpace(input.Summary)
	story.Status = input.Status
	story.Sort = input.Sort
	story.LatestContent = input.Content
	story.WordCount = storyWordCount(story.ContentType, input.Content)
	version := buildStoryVersion(*story, source)
	conflicted, err = s.repo.UpdateStoryWithVersion(story, version, input.BaseVersionID, volumeEvent)
	if err != nil {
		return nil, false, err
	}
	if story.ContentType == storytellerModel.ProjectContentTypeImage {
		if err := s.syncImageStoryAssetReferences(project.ID, story); err != nil {
			return nil, false, err
		}
	} else if err := s.syncMarkdownAssetReferences(project.ID, assetReferenceTargetStory, story.ID, story.LatestVersionID, story.LatestContent); err != nil {
		return nil, false, err
	}
	s.syncStorySearchIndex(project, story)
	return story, conflicted, nil
}

// MoveStory 只搬移故事所屬的冊，不動 title/summary/status/content，也不建立新版本
// （比照 MoveLore：純粹分類異動不算內容變更）。跟 UpdateStory 不同，呼叫端不需要先讀出
// 目前的 title/content 才能搬移，避免 agent 類的呼叫端漏帶內容而意外覆蓋掉故事。
func (s *Service) MoveStory(userID uint64, projectPublicID, storyPublicID string, input storytellerModel.StoryMoveRequest) (*storytellerModel.Story, error) {
	project, err := s.repo.ProjectByPublicIDForUser(userID, projectPublicID)
	if err != nil {
		return nil, err
	}
	story, err := s.repo.Story(project.ID, strings.TrimSpace(storyPublicID))
	if err != nil {
		return nil, err
	}
	if story.IsVolume {
		return nil, errors.New("cannot move a volume itself")
	}
	parent, err := s.resolveVolumeParent(project.ID, &input.VolumePublicID)
	if err != nil {
		return nil, err
	}
	previousParentID := story.ParentID
	story.ParentID = parentID(parent)
	volumeEvent := volumeMoveEvent(previousParentID, story.ParentID)
	if err := s.repo.MoveStory(story, volumeEvent); err != nil {
		return nil, err
	}
	return story, nil
}

// resolveVolumeParent 把呼叫端帶來的冊 public_id 轉成內部的 Story：留空代表不分冊，
// 目標必須存在且是冊（is_volume=true），否則視為請求錯誤——不支援冊中冊，一般故事
// 也不能把 parent_id 指到另一篇一般故事。
//
// AI Agent 呼叫 storyteller_upsert_story 時，即使工具描述寫明「省略這個 key 代表維持
// 原冊籍歸屬」，觀察到 Grok 有時還是會把這個可省略欄位填成 Python 風格的 "None" 字面
// 字串，而不是真的不帶這個 key。這裡把它當成跟空字串同義處理，不然會真的去找一本叫
// "None" 的冊，查無結果，套用提案就會失敗（外層看到的是誤導性的「project not found」）。
func (s *Service) resolveVolumeParent(projectID uint64, volumePublicID *string) (*storytellerModel.Story, error) {
	if volumePublicID == nil {
		return nil, nil
	}
	value := strings.TrimSpace(*volumePublicID)
	if value == "" || value == "None" {
		return nil, nil
	}
	parent, err := s.repo.Story(projectID, value)
	if err != nil {
		return nil, err
	}
	if !parent.IsVolume {
		return nil, errors.New("parent_id must reference a volume")
	}
	return parent, nil
}

func parentID(parent *storytellerModel.Story) *uint64 {
	if parent == nil {
		return nil
	}
	return &parent.ID
}

// volumeMoveEvent 比較異動前後的冊隸屬，沒變化就不需要寫紀錄。
func volumeMoveEvent(from, to *uint64) *storytellerModel.StoryVolumeEvent {
	if uint64PtrEqual(from, to) {
		return nil
	}
	return &storytellerModel.StoryVolumeEvent{FromVolumeID: from, ToVolumeID: to}
}

func uint64PtrEqual(a, b *uint64) bool {
	if a == nil || b == nil {
		return a == b
	}
	return *a == *b
}

// RevertStory 把故事內容回復到某個舊版本：讀出那個版本的內容，當成一次新的存檔寫入，
// 不會回頭改寫歷史，新版本會記下 RevertedFromVersionID。只回復 Title／Summary／Content，
// Status／Sort 這些故事層級的設定不受影響。
func (s *Service) RevertStory(userID uint64, projectPublicID, storyPublicID string, targetVersionID uint64, source string) (*storytellerModel.Story, error) {
	project, err := s.repo.ProjectByPublicIDForUser(userID, projectPublicID)
	if err != nil {
		return nil, err
	}
	story, err := s.repo.Story(project.ID, storyPublicID)
	if err != nil {
		return nil, err
	}
	target, err := s.repo.StoryVersion(story.ID, targetVersionID)
	if err != nil {
		return nil, err
	}
	story.Title = target.Title
	story.Summary = target.Summary
	story.LatestContent = target.Content
	if story.ContentType == storytellerModel.ProjectContentTypeImage {
		story.LatestContent, err = s.normalizeImageStoryContent(project.ID, story.LatestContent)
		if err != nil {
			return nil, err
		}
	} else if err := s.validateMarkdownAssetReferences(project.ID, story.LatestContent); err != nil {
		return nil, err
	}
	story.WordCount = target.WordCount
	version := buildStoryVersion(*story, source)
	version.RevertedFromVersionID = &target.ID
	if _, err := s.repo.UpdateStoryWithVersion(story, version, nil, nil); err != nil {
		return nil, err
	}
	if story.ContentType == storytellerModel.ProjectContentTypeImage {
		if err := s.syncImageStoryAssetReferences(project.ID, story); err != nil {
			return nil, err
		}
	} else if err := s.syncMarkdownAssetReferences(project.ID, assetReferenceTargetStory, story.ID, story.LatestVersionID, story.LatestContent); err != nil {
		return nil, err
	}
	s.syncStorySearchIndex(project, story)
	return story, nil
}

// DeleteStory 刪除一般故事或一冊。冊非空（底下還有故事）不能刪除，避免誤刪整冊內容；
// 一般故事若當下有 parent_id，補寫一筆 to_volume_id=NULL 的冊隸屬異動記錄，
// 否則冊被刪掉一篇故事後，時間軸上會完全看不出這篇曾經存在過。
func (s *Service) DeleteStory(userID uint64, projectPublicID, storyPublicID string) error {
	project, err := s.repo.ProjectByPublicIDForUser(userID, projectPublicID)
	if err != nil {
		return err
	}
	story, err := s.repo.Story(project.ID, storyPublicID)
	if err != nil {
		return err
	}
	if story.IsVolume {
		childrenCount, err := s.repo.VolumeChildrenCount(story.ID)
		if err != nil {
			return err
		}
		if childrenCount > 0 {
			return errors.New("cannot delete a volume that still has stories")
		}
	}
	volumeEvent := volumeMoveEvent(story.ParentID, nil)
	if err := s.repo.DeleteStory(story, volumeEvent); err != nil {
		return err
	}
	if story.ContentType == storytellerModel.ProjectContentTypeImage {
		if err := s.repo.ReplaceAssetReferences(assetReferenceTargetImageStory, story.ID, nil); err != nil {
			return err
		}
	} else if err := s.repo.ReplaceAssetReferences(assetReferenceTargetStory, story.ID, nil); err != nil {
		return err
	}
	s.removeStorySearchDocument(story.PublicID)
	return nil
}

// Volumes 回傳一個專案底下的冊列表，跟一般故事列表分開拿。
func (s *Service) Volumes(userID uint64, projectPublicID string) ([]storytellerModel.Story, error) {
	project, err := s.repo.ProjectByPublicIDForUser(userID, projectPublicID)
	if err != nil {
		return nil, err
	}
	return s.repo.Volumes(project.ID)
}

// CreateVolume 建立一冊：只有標題，內容／摘要／狀態欄位不使用，也不能有 parent_id（不支援冊中冊）。
func (s *Service) CreateVolume(userID uint64, projectPublicID string, input storytellerModel.StoryVolumeRequest, source string) (*storytellerModel.Story, error) {
	input = normalizeVolumeRequest(input)
	if err := validateVolume(input); err != nil {
		return nil, err
	}
	project, err := s.repo.ProjectByPublicIDForUser(userID, projectPublicID)
	if err != nil {
		return nil, err
	}
	volume := &storytellerModel.Story{
		PublicID:    randomID(),
		ProjectID:   project.ID,
		IsVolume:    true,
		ContentType: input.ContentType,
		Title:       strings.TrimSpace(input.Title),
		Summary:     input.Summary,
		Sort:        input.Sort,
		Status:      input.Status,
	}
	version := buildStoryVersion(*volume, source)
	if err := s.repo.CreateStoryWithVersion(volume, version, nil); err != nil {
		return nil, err
	}
	return volume, nil
}

// UpdateVolume 重新命名／改摘要／切換公開狀態，跟一般故事的 UpdateStory 分開，不能改內容。
// ContentType 建立後不可變更，這裡刻意忽略請求裡帶的值，永遠維持建立時的設定。
// Status 關閉（draft）時，底下所有故事一律不對外顯示，不管故事自己的 status 是什麼，
// 見 Repository.PublishedStories／PublishedVolumes 的過濾邏輯。
func (s *Service) UpdateVolume(userID uint64, projectPublicID, volumePublicID string, input storytellerModel.StoryVolumeRequest, source string) (*storytellerModel.Story, error) {
	input = normalizeVolumeRequest(input)
	if err := validateVolume(input); err != nil {
		return nil, err
	}
	project, err := s.repo.ProjectByPublicIDForUser(userID, projectPublicID)
	if err != nil {
		return nil, err
	}
	volume, err := s.repo.Story(project.ID, volumePublicID)
	if err != nil {
		return nil, err
	}
	if !volume.IsVolume {
		return nil, errors.New("target is not a volume")
	}
	volume.Title = strings.TrimSpace(input.Title)
	volume.Summary = input.Summary
	volume.Sort = input.Sort
	volume.Status = input.Status
	version := buildStoryVersion(*volume, source)
	if _, err := s.repo.UpdateStoryWithVersion(volume, version, nil, nil); err != nil {
		return nil, err
	}
	s.resyncProjectSearchIndex(project)
	return volume, nil
}

// DeleteVolume 刪冊：先確認 target 真的是冊（不是一般故事），非空冊由內部呼叫的
// DeleteStory／VolumeChildrenCount 檢查擋掉，跟 UpdateVolume 的檢查方式一致。
func (s *Service) DeleteVolume(userID uint64, projectPublicID, volumePublicID string) error {
	project, err := s.repo.ProjectByPublicIDForUser(userID, projectPublicID)
	if err != nil {
		return err
	}
	volume, err := s.repo.Story(project.ID, volumePublicID)
	if err != nil {
		return err
	}
	if !volume.IsVolume {
		return errors.New("target is not a volume")
	}
	return s.DeleteStory(userID, projectPublicID, volumePublicID)
}

// ImageStoryPages 是作者管理頁／預覽用的圖像頁列表，不限公開狀態（可以看到草稿）。
// 「話」現在就是一筆 ContentType=image 的一般 Story，LatestContent 存 StoryImageContent
// 的 JSON，這裡讀出來後逐一把 key 簽成可讀的 CloudFront 網址，不落地存簽名結果。
func (s *Service) ImageStoryPages(userID uint64, projectPublicID, storyPublicID string) ([]storytellerModel.StoryImagePageOutput, error) {
	story, err := s.storyForUserProject(userID, projectPublicID, storyPublicID)
	if err != nil {
		return nil, err
	}
	if story.ContentType != storytellerModel.ProjectContentTypeImage {
		return nil, errors.New("story is not an image story")
	}
	return s.signStoryImageContent(story.ProjectID, story.LatestContent, true)
}

// PublicImageStoryPages 是公開閱讀頁用的版本，只有已發布（completed）的話才能讀到。
func (s *Service) PublicImageStoryPages(projectValue, storyPublicID string, viewerID uint64) ([]storytellerModel.StoryImagePageOutput, error) {
	story, err := s.publicPublishedStory(viewerID, publicProjectIDFromPath(projectValue), storyPublicID)
	if err != nil {
		return nil, err
	}
	if story.ContentType != storytellerModel.ProjectContentTypeImage {
		return nil, errors.New("image story not found")
	}
	return s.signReaderStoryImageContent(story.ProjectID, story.LatestContent)
}

// SharedImageStoryPages 是分享連結閱讀頁用的版本，邏輯跟 PublicImageStoryPages 一樣，
// 只是專案改用 share token 找。
func (s *Service) SharedImageStoryPages(token, storyPublicID string) ([]storytellerModel.StoryImagePageOutput, error) {
	project, err := s.repo.ProjectByShareToken(strings.TrimSpace(token))
	if err != nil {
		return nil, err
	}
	return s.publishedImageStoryPages(project, storyPublicID)
}

func (s *Service) publishedImageStoryPages(project *storytellerModel.Project, storyPublicID string) ([]storytellerModel.StoryImagePageOutput, error) {
	story, err := s.repo.PublishedStory(project.ID, storyPublicID)
	if err != nil {
		return nil, err
	}
	if story.ContentType != storytellerModel.ProjectContentTypeImage {
		return nil, errors.New("image story not found")
	}
	return s.signReaderStoryImageContent(project.ID, story.LatestContent)
}

func (s *Service) signReaderStoryImageContent(projectID uint64, rawContent string) ([]storytellerModel.StoryImagePageOutput, error) {
	outputs, err := s.signStoryImageContent(projectID, rawContent, false)
	if err != nil {
		return nil, err
	}
	for i := range outputs {
		outputs[i].Description, err = s.signAssetURIsInContent(projectID, outputs[i].Description)
		if err != nil {
			return nil, err
		}
	}
	return outputs, nil
}

// imagePageKeys 解析 StoryImageContent JSON，取出每一頁的 S3 key，供存檔前的
// validateImagePageSizes 檢查檔案大小用。
func imagePageKeys(rawContent string) ([]string, error) {
	var content storytellerModel.StoryImageContent
	if strings.TrimSpace(rawContent) != "" {
		if err := json.Unmarshal([]byte(rawContent), &content); err != nil {
			return nil, fmt.Errorf("parse image story content: %w", err)
		}
	}
	keys := make([]string, 0, len(content.Pages))
	for _, page := range content.Pages {
		keys = append(keys, page.Key)
	}
	return keys, nil
}

// signStoryImageContent 解析 Story.LatestContent 的 StoryImageContent JSON，
// 把每一頁的 key 簽成可讀的 CloudFront 網址。includeKey 只有作者本人的管理頁會傳
// true，把原始 S3 key 一併回傳給編輯頁重組完整 JSON 用；公開／分享閱讀頁一律 false。
func (s *Service) signStoryImageContent(projectID uint64, rawContent string, includeKey bool) ([]storytellerModel.StoryImagePageOutput, error) {
	var content storytellerModel.StoryImageContent
	if strings.TrimSpace(rawContent) != "" {
		if err := json.Unmarshal([]byte(rawContent), &content); err != nil {
			return nil, fmt.Errorf("parse image story content: %w", err)
		}
	}
	publicIDs := make([]string, 0, len(content.Pages))
	for _, page := range content.Pages {
		if strings.TrimSpace(page.Key) == "" && strings.TrimSpace(page.AssetPublicID) != "" {
			publicIDs = append(publicIDs, strings.TrimSpace(page.AssetPublicID))
		}
	}
	assets, err := s.assetsByPublicID(projectID, uniqueStrings(publicIDs))
	if err != nil {
		return nil, err
	}
	outputs := make([]storytellerModel.StoryImagePageOutput, 0, len(content.Pages))
	for _, page := range content.Pages {
		key := strings.TrimSpace(page.Key)
		if key == "" && strings.TrimSpace(page.AssetPublicID) != "" {
			key = assets[strings.TrimSpace(page.AssetPublicID)].S3Key
		}
		imageURL, err := signImageURL(key)
		if err != nil {
			return nil, err
		}
		outputKey := ""
		if includeKey {
			outputKey = key
		}
		outputs = append(outputs, storytellerModel.StoryImagePageOutput{
			ID:            page.ID,
			Key:           outputKey,
			AssetPublicID: page.AssetPublicID,
			ImageURL:      imageURL,
			Description:   page.Description,
			Sort:          page.Sort,
		})
	}
	sort.Slice(outputs, func(i, j int) bool { return outputs[i].Sort < outputs[j].Sort })
	return outputs, nil
}

// VolumeActivity 組合一冊的活動歷史：Events 是冊隸屬異動（新增/搬移/移出/刪除），
// Versions 是衍生查詢——底下故事（依目前 parent_id）存檔產生的版本記錄。
func (s *Service) VolumeActivity(userID uint64, projectPublicID, volumePublicID string) (*storytellerModel.StoryVolumeActivity, error) {
	project, err := s.repo.ProjectByPublicIDForUser(userID, projectPublicID)
	if err != nil {
		return nil, err
	}
	volume, err := s.repo.Story(project.ID, volumePublicID)
	if err != nil {
		return nil, err
	}
	if !volume.IsVolume {
		return nil, errors.New("target is not a volume")
	}
	events, err := s.repo.StoryVolumeEvents(volume.ID)
	if err != nil {
		return nil, err
	}
	versions, err := s.repo.ChildStoryVersions(volume.ID)
	if err != nil {
		return nil, err
	}
	return &storytellerModel.StoryVolumeActivity{Events: events, Versions: versions}, nil
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

// publicPublishedStory 回傳讀者可讀取的故事：專案為公開／不公開連結時，任何人都能看
// 已公開的故事；專案是私人的，就只有專案本人能看，而且不受 status=completed 限制
// （本人在 Reader 頁預覽/操作自己的私人草稿時，書籤等功能不該被 visibility 或 status 擋掉）。
// 供書籤與版本查詢等「讀者視角」功能共用權限判斷。userID 傳 0 代表呼叫端本來就沒有登入
// 狀態可用（例如未加驗證的公開路由），行為等同純粹的公開/不公開連結存取。
func (s *Service) publicPublishedStory(userID uint64, projectPublicID, storyPublicID string) (*storytellerModel.Story, error) {
	project, err := s.repo.ProjectByPublicIDForReader(userID, projectPublicID)
	if err != nil {
		return nil, err
	}
	if userID != 0 && project.UserID == userID {
		return s.repo.Story(project.ID, storyPublicID)
	}
	return s.repo.PublishedStory(project.ID, storyPublicID)
}

// viewerID 同 PublicProject，是可選的（見 controller 的 optionalViewerID）——讓故事本人
// 預覽自己私人專案裡的草稿故事時，這條公開路由也能正常回傳版本資訊。
func (s *Service) PublicStoryLatestVersion(projectPublicID, storyPublicID string, viewerID uint64) (*storytellerModel.StoryVersion, error) {
	story, err := s.publicPublishedStory(viewerID, projectPublicID, storyPublicID)
	if err != nil {
		return nil, err
	}
	version, err := s.repo.LatestStoryVersion(story.ID)
	if err != nil {
		return nil, err
	}
	if story.ContentType != storytellerModel.ProjectContentTypeImage {
		version.Content, err = s.signAssetURIsInContent(story.ProjectID, version.Content)
		if err != nil {
			return nil, err
		}
	}
	return version, nil
}

func (s *Service) PublicStoryVersions(projectPublicID, storyPublicID string, viewerID uint64) ([]storytellerModel.StoryVersion, error) {
	story, err := s.publicPublishedStory(viewerID, projectPublicID, storyPublicID)
	if err != nil {
		return nil, err
	}
	rows, err := s.repo.StoryVersions(story.ID)
	if err != nil {
		return nil, err
	}
	if story.ContentType == storytellerModel.ProjectContentTypeImage {
		return rows, nil
	}
	for i := range rows {
		rows[i].Content, err = s.signAssetURIsInContent(story.ProjectID, rows[i].Content)
		if err != nil {
			return nil, err
		}
	}
	return rows, nil
}

// ProjectStoryBookmarks 组出專案內所有書籤（文字＋圖片混在一起，依 content_type 分開
// 處理）：文字書籤把對應版本內容分組（groupStoryLinesByBlockKind），找出 line_id 指到的
// 那一組取預覽文字；圖片書籤逐一解析所屬話目前的內容 JSON，算出書籤指到的頁面現在排第
// 幾頁、簽出縮圖網址——頁面已經被刪除的書籤 PageSort 回 -1，前端可以用這個判斷書籤已經
// 失效。文字書籤的分組結果用 version id 快取，同一個版本被多筆書籤指到時不用重複解析。
func (s *Service) ProjectStoryBookmarks(userID uint64, projectPublicID string) ([]storytellerModel.StoryBookmarkOutput, error) {
	project, err := s.repo.ProjectByPublicIDForReader(userID, projectPublicID)
	if err != nil {
		return nil, err
	}
	rows, err := s.repo.ProjectStoryBookmarks(userID, project.ID)
	if err != nil {
		return nil, err
	}
	contentByStoryID := make(map[uint64]storytellerModel.StoryImageContent)
	groupsByVersionID := make(map[uint64][]storyLineGroup)
	for i := range rows {
		if rows[i].ContentType != storytellerModel.ProjectContentTypeImage {
			if rows[i].StoryVersionID == nil {
				continue
			}
			versionID := *rows[i].StoryVersionID
			groups, ok := groupsByVersionID[versionID]
			if !ok {
				version, err := s.repo.StoryVersion(rows[i].StoryID, versionID)
				if err != nil {
					// 版本可能已被刪除（例如軟刪除的舊版本）；書籤預覽寬鬆處理，找不到就留空，
					// 不能讓整個書籤列表因為單一筆壞資料整個掛掉。快取這個失敗結果，避免同一個
					// 版本被多筆書籤指到時重複查詢。
					groupsByVersionID[versionID] = nil
					continue
				}
				groups = groupStoryLinesByBlockKind(version.Content)
				groupsByVersionID[versionID] = groups
			}
			rows[i].LinePreview = storyBookmarkLinePreview(groups, rows[i].LineID)
			continue
		}
		content, ok := contentByStoryID[rows[i].StoryID]
		if !ok {
			story, err := s.repo.Story(project.ID, rows[i].StoryPublicID)
			if err != nil {
				return nil, err
			}
			content = mustParseImageContent(story.LatestContent)
			contentByStoryID[rows[i].StoryID] = content
		}
		rows[i].PageSort = -1
		for _, page := range content.Pages {
			if page.ID != rows[i].LineID {
				continue
			}
			rows[i].PageSort = page.Sort
			if imageURL, err := signImageURL(page.Key); err == nil {
				rows[i].ThumbnailURL = imageURL
			}
			break
		}
	}
	return rows, nil
}

// storyMarkerPattern 比照前端 wysiwygCore/parser.ts 的 MARKER_PATTERN：段落 marker 開頭是
// markerId，接著可選的 align 屬性，這個屬性的值這裡不需要解析出來，比對到就整段丟棄即可。
//
// 註解（comment）2026-07-09 起改成行內 marker（見 storyInlineMarkerPattern），新資料不會
// 再把 comment／commentColor 寫在段落 marker 上——但這裡刻意繼續保留這兩個屬性的比對
// （選配、不擷取值），純粹是為了相容 2026-07-09 之前存的舊資料：Go 這邊本來就只是把
// comment 屬性整個丟棄（從來不會把註解內容算進字數或書籤預覽），不管新舊格式都一樣「丟掉
// 就好」，所以不需要另外寫遷移邏輯，繼續比對舊屬性只是避免舊段落因為多了這兩個屬性、
// 整個 marker 比對失敗，退化成把原始 `⟦...⟧` 語法當純文字外洩到字數/書籤預覽。
var storyMarkerPattern = regexp.MustCompile(
	`^⟦([^⟧\s]*)(?: align="(?:left|center|right)")?(?: comment="(?:[^"\\]|\\.)*")?(?: commentColor="(?:yellow|pink|blue|green|purple)")?⟧([\s\S]*)⟦/([^⟧\s]*)⟧$`,
)

// blockKindPrefixPattern 比照前端 whitelist.ts 的 blockKindPrefix：引用 `> `、無序清單
// `- `、有序清單「數字 + `. `」（數字不驗證連續性，任何數字都算數，見前端
// BLOCK_KIND_NUMBER_PARSE_PATTERN 的說明——有序清單一律自動編號，存進去的數字本身
// 沒有意義）、分隔線 `---`、表格列開頭的 `|`（列內其餘的 `|` 是儲存格分隔符，不是這裡
// 要剝掉的行首前綴，字數/書籤預覽會照原樣留著，不特別拆欄位）。跟標題前綴互斥，
// splitHeadingAndMarkerContent 只有在沒有標題前綴時才會嘗試比對這個 pattern。
var blockKindPrefixPattern = regexp.MustCompile(`^(?:---|> |- |\d+\. |\|)`)

// storyBlockKind 對應前端 whitelist.ts 的 BlockKindValue，只列 Go 端分組邏輯需要區分的
// 種類（none 代表一般段落/標題，不會跟其他行合併成一組）。
type storyBlockKind string

const (
	storyBlockKindNone     storyBlockKind = "none"
	storyBlockKindQuote    storyBlockKind = "quote"
	storyBlockKindBullet   storyBlockKind = "bullet"
	storyBlockKindNumber   storyBlockKind = "number"
	storyBlockKindHR       storyBlockKind = "hr"
	storyBlockKindTable    storyBlockKind = "table"
	storyBlockKindTableRow storyBlockKind = "table-row"
)

// blockKindFromPrefix 把 splitHeadingAndMarkerContent 算出來的 headingLevel／blockPrefix
// 轉成分類用的 storyBlockKind。有序清單的前綴不是固定字串（「數字 + `. `」，數字不驗證
// 連續性），沒辦法用字面比對，所以用刪去法：排除掉其他三種固定前綴跟空字串後，只要
// blockKindPrefixPattern 有比對到東西，剩下的可能就只有有序清單——這個假設綁定
// blockKindPrefixPattern 目前只有這五種 alternative，之後若要再加新的 blockKind 前綴，
// 這裡也要跟著補一個明確的 case，不能只靠刪去法。
func blockKindFromPrefix(headingLevel int, blockPrefix string) storyBlockKind {
	if headingLevel > 0 || blockPrefix == "" {
		return storyBlockKindNone
	}
	switch blockPrefix {
	case "---":
		return storyBlockKindHR
	case "> ":
		return storyBlockKindQuote
	case "- ":
		return storyBlockKindBullet
	case "|":
		return storyBlockKindTableRow
	default:
		return storyBlockKindNumber
	}
}

// storyLineGroup 對應前端 parser.ts 的 groupParagraphsByBlockKind：把連續同 blockKind 的行
// 合成一組，"none"（一般段落/標題）永遠各自獨立成一組。startIndex 是這組第一行在
// content.split("\n") 陣列裡的位置（0-based）——書籤的定位單位是「組」而不是原始行號
// （2026-08-08 起，見 storyteller_story_bookmarks 的欄位說明），startIndex 就是存進
// StoryBookmark.LineID 的值，兩邊的分組規則必須完全一致，否則書籤定位會跟前端渲染出來的
// 分組對不上。
type storyLineGroup struct {
	blockKind  storyBlockKind
	startIndex int
	lines      []string
	tableID    string
}

func groupStoryLinesByBlockKind(content string) []storyLineGroup {
	lines := strings.Split(content, "\n")
	groups := make([]storyLineGroup, 0, len(lines))
	for i, line := range lines {
		if tableID, _, ok := parseStoryTableMarker(line); ok {
			if tableID == "" {
				tableID = fmt.Sprintf("tbl_missing_%d", i)
			}
			if n := len(groups); n > 0 && groups[n-1].blockKind == storyBlockKindTable && groups[n-1].tableID == tableID {
				groups[n-1].lines = append(groups[n-1].lines, line)
				continue
			}
			groups = append(groups, storyLineGroup{blockKind: storyBlockKindTable, startIndex: i, lines: []string{line}, tableID: tableID})
			continue
		}

		headingLevel, blockPrefix, _ := splitHeadingAndMarkerContent(line)
		kind := blockKindFromPrefix(headingLevel, blockPrefix)
		if n := len(groups); n > 0 && groups[n-1].blockKind == kind && kind != storyBlockKindNone {
			groups[n-1].lines = append(groups[n-1].lines, line)
			continue
		}
		groups = append(groups, storyLineGroup{blockKind: kind, startIndex: i, lines: []string{line}})
	}
	return groups
}

// storyBlockKindLabel 書籤摘要用的區塊類型標籤。quote/bullet/number/table-row 是好幾行
// 合併成一組的書籤（見 groupStoryLinesByBlockKind），單看第一行原始文字（`> `／`- `／
// `|` 這些前綴字元）不容易一眼看出這是引用/清單/表格，前面加個標籤讓書籤列表好辨識；
// 分隔線完全沒有文字內容，只能靠標籤。"none"（一般段落/標題）不需要標籤，段落本身的
// 文字就很清楚。
func storyBlockKindLabel(kind storyBlockKind) string {
	switch kind {
	case storyBlockKindQuote:
		return "引用"
	case storyBlockKindBullet, storyBlockKindNumber:
		return "清單"
	case storyBlockKindHR:
		return "分隔線"
	case storyBlockKindTable, storyBlockKindTableRow:
		return "表格"
	default:
		return ""
	}
}

var storyTableMarkerPattern = regexp.MustCompile(`^⟦table((?: [A-Za-z]+="(?:[^"\\]|\\.)*")*)⟧([\s\S]*)⟦/table⟧$`)
var storyTableAttrPattern = regexp.MustCompile(`([A-Za-z]+)="((?:[^"\\]|\\.)*)"`)

func parseStoryTableMarker(line string) (string, string, bool) {
	match := storyTableMarkerPattern.FindStringSubmatch(line)
	if match == nil {
		return "", "", false
	}
	tableID := ""
	for _, attr := range storyTableAttrPattern.FindAllStringSubmatch(match[1], -1) {
		if attr[1] == "tableId" {
			tableID = strings.TrimSpace(unescapeMarkerAttr(attr[2]))
			break
		}
	}
	return tableID, match[2], true
}

func unescapeTableCell(cell string) string {
	var b strings.Builder
	for i := 0; i < len(cell); i++ {
		if cell[i] == '\\' && i < len(cell)-1 {
			switch cell[i+1] {
			case '|', '\\':
				b.WriteByte(cell[i+1])
				i++
				continue
			case 'n':
				b.WriteByte('\n')
				i++
				continue
			}
		}
		b.WriteByte(cell[i])
	}
	return b.String()
}

func splitStoryTableCells(rowText string) []string {
	cells := make([]string, 0, 4)
	var current strings.Builder
	for i := 0; i < len(rowText); i++ {
		if rowText[i] == '\\' {
			current.WriteByte(rowText[i])
			if i < len(rowText)-1 {
				i++
				current.WriteByte(rowText[i])
			}
			continue
		}
		if rowText[i] == '|' {
			cells = append(cells, current.String())
			current.Reset()
			continue
		}
		current.WriteByte(rowText[i])
	}
	cells = append(cells, current.String())

	if len(cells) > 1 && strings.TrimSpace(cells[0]) == "" {
		cells = cells[1:]
	}
	if len(cells) > 1 && strings.TrimSpace(cells[len(cells)-1]) == "" {
		cells = cells[:len(cells)-1]
	}
	for i, cell := range cells {
		cells[i] = unescapeTableCell(strings.TrimSpace(cell))
	}
	return cells
}

func stripStoryTableRowContent(rowText, imageReplacement, separator string) string {
	cells := splitStoryTableCells(rowText)
	for i, cell := range cells {
		cell = stripStoryInlineMarkers(cell)
		cell = markdownImagePattern.ReplaceAllString(cell, imageReplacement)
		cells[i] = stripDelimitersFrom(cell, wordCountInlineDelimiters)
	}
	return strings.Join(cells, separator)
}

// stripBookmarkLinePreviewContent 跟 stripReadableLineMarkup 一樣去掉段落 marker／行內
// marker／圖片語法，但不把 blockKind 前綴加回去——只給有 storyBlockKindLabel 的書籤預覽
// 用，標籤已經說明這是什麼類型，原始前綴字元（`> `／`- `／`|` 等）留著只是多餘、也不乾淨。
func stripBookmarkLinePreviewContent(line string) string {
	if _, rowText, ok := parseStoryTableMarker(line); ok {
		return stripStoryTableRowContent(rowText, "（圖片）", " | ")
	}
	_, _, content := splitHeadingAndMarkerContent(line)
	content = stripStoryInlineMarkers(content)
	return markdownImagePattern.ReplaceAllString(content, "（圖片）")
}

// storyBookmarkLinePreview 在分組結果裡找出 lineID（=組的起始行號字串）對應的那一組，
// 回傳預覽文字：有標籤的類型（引用/清單/表格/分隔線）前面加上 `[標籤]`，分隔線本身沒有
// 文字內容，只顯示標籤；其餘沿用去除 marker 語法後的第一行文字。多行的組（引用/清單/
// 表格）加上省略號提示還有更多內容，書籤列表只需要一眼認出是哪一段，不用把整組塞進預覽。
func storyBookmarkLinePreview(groups []storyLineGroup, lineID string) string {
	startIndex, err := strconv.Atoi(lineID)
	if err != nil {
		return ""
	}
	for _, group := range groups {
		if group.startIndex != startIndex {
			continue
		}
		label := storyBlockKindLabel(group.blockKind)
		if group.blockKind == storyBlockKindHR {
			return "[" + label + "]"
		}
		var preview string
		if label != "" {
			preview = "[" + label + "] " + stripBookmarkLinePreviewContent(group.lines[0])
		} else {
			preview = stripBookmarkLineMarker(group.lines[0])
		}
		if len(group.lines) > 1 {
			preview += " ⋯"
		}
		return preview
	}
	return ""
}

// splitHeadingAndMarkerContent 拿掉標題前綴（回傳 headingLevel）、引用/清單前綴（回傳
// blockPrefix，跟標題互斥，只有沒有標題時才會比對）跟段落 marker（含 align 屬性），
// 回傳段落真正的可讀內容。是 stripBookmarkLineMarker 跟 wordCount 共用的底層邏輯，
// DB 裡的 content 存的是含 marker 語法的原始行（見 storyteller_story_versions 遷移後的
// 格式），這兩個地方都需要在 Go 這邊做語法層面的清理。
func splitHeadingAndMarkerContent(line string) (int, string, string) {
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

	blockPrefix := ""
	if headingLevel == 0 {
		if match := blockKindPrefixPattern.FindString(content); match != "" {
			blockPrefix = match
			content = content[len(match):]
		}
	}

	if match := storyMarkerPattern.FindStringSubmatch(content); match != nil && match[1] == match[3] {
		content = match[2]
	}

	return headingLevel, blockPrefix, content
}

// backfillStoryMarkerIds 幫任何還沒有段落 markerId 的行補一個新的，行為對應前端
// wysiwygCore/markerParagraph.ts 的 appendTransaction 自動補 id 機制——那套機制
// 綁在活著的 Tiptap 編輯器實例上，只有內容真的流過網頁編輯器的 setContent／
// onUpdate 才會觸發。MCP 用 PAT 直接呼叫 storyteller_upsert_story／
// storyteller_upsert_lore、或 AI agent 提案套用時，內容從沒進過編輯器，一路
// 存到這裡都不會有 markerId；markerId 是書籤/標題錨點/閱讀頁 TOC 的定位依據，
// 沒有的話這些功能都連不到對應段落。統一在存檔前這個關卡補齊，前端／MCP／
// AI 都不用管這件事，也不用在各自的呼叫端各刻一份——已經有合法 markerId 的行
// 原樣跳過，對任何內容重複呼叫都是 no-op，可以安全地無條件套用在每一次存檔。
//
// 逐行處理（跟前端 serializeDocToMarkdown 的「一行一段落」慣例對稱），表格列
// 有自己的 tableId／rowId 機制，不歸這裡管，直接跳過。
func backfillStoryMarkerIds(content string) string {
	lines := strings.Split(content, "\n")
	changed := false
	for i, line := range lines {
		if _, _, ok := parseStoryTableMarker(line); ok {
			continue
		}
		headingLevel := 0
		for headingLevel < 6 && headingLevel < len(line) && line[headingLevel] == '#' {
			headingLevel++
		}
		prefixEnd := 0
		if headingLevel > 0 && headingLevel < len(line) && line[headingLevel] == ' ' {
			prefixEnd = headingLevel + 1
		}
		rest := line[prefixEnd:]
		blockPrefix := ""
		if prefixEnd == 0 {
			if match := blockKindPrefixPattern.FindString(rest); match != "" {
				blockPrefix = match
				rest = rest[len(match):]
			}
		}
		if match := storyMarkerPattern.FindStringSubmatch(rest); match != nil && match[1] == match[3] && match[1] != "" {
			continue
		}
		newMarkerId := randomID()
		lines[i] = line[:prefixEnd] + blockPrefix + "⟦" + newMarkerId + "⟧" + rest + "⟦/" + newMarkerId + "⟧"
		changed = true
	}
	if !changed {
		return content
	}
	return strings.Join(lines, "\n")
}

// storyInlineMarkerPattern 比照前端 wysiwygCore/parser.ts 的行內 marker（span 文字顏色、
// a 連結、footnote 腳注、comment 註解等）：`⟦<type>-<id> attr="..."⟧` 開頭跟
// `⟦/<type>-<id>⟧` 結尾。這裡不管配對、單純把記號本身抽掉（保留被包住的文字），因為
// 字數計算跟書籤預覽都只需要看得到的文字——腳注的 note 屬性值（讀者看不到的內文）也會
// 隨著整個開頭標記一起被丟掉，這是刻意的：字數另外由 extractFootnoteWordCount 獨立算好
// 併入 wordCount，不能讓它在這裡被算進本文字數。註解（comment）的內文本來就完全不該算進
// 字數/書籤預覽，跟以前是段落屬性時的行為一致，這裡整段丟掉正是想要的效果，不需要額外抽取。
var storyInlineMarkerPattern = regexp.MustCompile(
	`⟦/?(?:span|a|footnote|comment)-[^⟧\s]+(?: [A-Za-z]+="(?:[^"\\]|\\.)*")*⟧`,
)

// markerAttrEscapeRegexp 是前端 escapeMarkerComment 的反向操作（unescapeMarkerComment）：
// 把 `\X` 還原成 `X`，不管 X 是什麼字元。
var markerAttrEscapeRegexp = regexp.MustCompile(`\\(.)`)

func unescapeMarkerAttr(escaped string) string {
	return markerAttrEscapeRegexp.ReplaceAllString(escaped, "$1")
}

// footnoteOpenPattern 只比對腳注行內 marker 的「開頭」標記（帶 note 屬性），跟一般的
// storyInlineMarkerPattern 不同：這裡要把 note 的值抽出來算字數，不是丟掉。結尾標記
// `⟦/footnote-id⟧` 沒有 note="..." 這段，天然不會被這個 pattern 誤配到。
var footnoteOpenPattern = regexp.MustCompile(
	`⟦footnote-([^⟧\s]+) note="((?:[^"\\]|\\.)*)"⟧`,
)

// markdownImagePattern 對應前端 whitelist.ts 的 MARKDOWN_IMAGE_PATTERN；資產在作者端是
// steamloom-asset://，公開閱讀端可能已被簽成 https URL。字數計算不應把 URI 算進正文。
var markdownImagePattern = regexp.MustCompile(`!\[([^\]\r\n]*)\]\((?:steamloom-asset://[A-Za-z0-9._~-]+|https?://[^)\s]+)\)`)

// extractFootnoteNotes 依文件出現順序收集每一則腳注的原始內文（尚未拿掉粗體等 delimiter），
// 同一個 id 只收集一次——正常存檔的內容裡一個 id 本來就只會出現一次開頭標記，這裡加上
// dedupe 只是防禦性處理，避免不正常/手動改過的資料被重複計算字數。
func extractFootnoteNotes(content string) []string {
	matches := footnoteOpenPattern.FindAllStringSubmatch(content, -1)
	seen := make(map[string]bool, len(matches))
	notes := make([]string, 0, len(matches))
	for _, match := range matches {
		id := match[1]
		if seen[id] {
			continue
		}
		seen[id] = true
		notes = append(notes, unescapeMarkerAttr(match[2]))
	}
	return notes
}

// stripStoryInlineMarkers 把一段內容裡的行內 marker 記號（span 顏色等）抽掉，只留下被包住的文字。
func stripStoryInlineMarkers(content string) string {
	return storyInlineMarkerPattern.ReplaceAllString(content, "")
}

// stripReadableLineMarkup 去掉故事行裡的段落 marker（含 align/comment/commentColor 屬性）
// 跟行內 marker（span 顏色等），保留標題／引用／清單前綴，只留下可讀文字。imageReplacement
// 由呼叫端決定，避免書籤側欄露出檔名，但搜尋索引仍可吃到 alt/title。
func stripReadableLineMarkup(line, imageReplacement string) string {
	if _, rowText, ok := parseStoryTableMarker(line); ok {
		return stripStoryTableRowContent(rowText, imageReplacement, " | ")
	}
	headingLevel, blockPrefix, content := splitHeadingAndMarkerContent(line)
	content = stripStoryInlineMarkers(content)
	content = markdownImagePattern.ReplaceAllString(content, imageReplacement)
	if headingLevel > 0 {
		return strings.Repeat("#", headingLevel) + " " + content
	}
	return blockPrefix + content
}

// stripBookmarkLineMarker 給 Reader 書籤側欄摘要使用。資產圖片的 alt 常是原始檔名，
// 不該在讀者介面露出，因此統一用短文案表示這行是圖片。
func stripBookmarkLineMarker(line string) string {
	return stripReadableLineMarkup(line, "（圖片）")
}

// stripSearchIndexLineMarker 給搜尋索引用；這裡保留圖片 alt/title，方便使用者用資產命名
// 找到包含該圖片的內容。
func stripSearchIndexLineMarker(line string) string {
	return stripReadableLineMarkup(line, "$1")
}

// wordCountInlineDelimiters 比照前端 whitelist.ts 的 PARSE_DELIMITERS，長的寫法要排在前面
// （例如 ** 要早於 *），避免誤判成短的那個。
var wordCountInlineDelimiters = []string{"**", "__", "++", "--", "*", "~", "^"}

// footnoteInlineDelimiters 比照前端 FOOTNOTE_PARSE_DELIMITERS：腳注內文只接受粗體/斜體/
// 底線，故意不含 ~/^（上下標）——如果腳注內文剛好打了字面上的 ~ 或 ^，前端限縮版解析器
// （parseFootnoteNoteRuns）會把它們當純文字保留，這裡字數計算也不能把它們當 delimiter 拿掉，
// 不然字數會跟讀者實際看到的內容對不起來。
var footnoteInlineDelimiters = []string{"**", "__", "++", "*"}

// stripDelimitersFrom 拿掉指定的行內樣式 delimiter 清單，只留下記號包住的文字本身，邏輯
// 對應前端 parseInline 把 delimiter 轉成 marks、只留 run.text 的效果。給 wordCount（六種
// delimiter 都拿）跟 extractFootnoteWordCount（腳注內文限縮版，只有四種）共用同一套邏輯。
func stripDelimitersFrom(text string, delimiters []string) string {
	var b strings.Builder
	for i := 0; i < len(text); {
		matched := false
		for _, d := range delimiters {
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

// extractFootnoteWordCount 加總所有腳注內文（拿掉限縮版 delimiter 之後）的字數，跟本文
// 字數分開算，但併入同一個 wordCount 總數——使用者要求「腳註內容需要算進故事字數」。
func extractFootnoteWordCount(content string) uint {
	var builder strings.Builder
	for _, note := range extractFootnoteNotes(content) {
		builder.WriteString(stripDelimitersFrom(note, footnoteInlineDelimiters))
	}
	normalized := whitespaceRegexp.ReplaceAllString(builder.String(), "")
	return uint(len([]rune(normalized)))
}

func (s *Service) StoryBookmarks(userID uint64, projectPublicID, storyPublicID string) ([]storytellerModel.StoryBookmark, error) {
	story, err := s.publicPublishedStory(userID, projectPublicID, storyPublicID)
	if err != nil {
		return nil, err
	}
	return s.repo.StoryBookmarks(userID, story.ID)
}

// CreateStoryBookmark 依故事的 content_type 分兩條路：文字故事沿用原本「只能對最新版本
// 加書籤」規則，lineID 是行號的字串形式，綁定 versionID；圖片故事（話）的 lineID 是
// StoryImagePage.ID，不綁版本（story_version_id 留 NULL），但要求該頁必須存在於目前的
// 內容裡才能加書籤。versionID 對圖片故事沒有意義，呼叫端可以傳 0。
func (s *Service) CreateStoryBookmark(userID uint64, projectPublicID, storyPublicID, lineID string, versionID uint64) (*storytellerModel.StoryBookmark, error) {
	story, err := s.publicPublishedStory(userID, projectPublicID, storyPublicID)
	if err != nil {
		return nil, err
	}

	if story.ContentType == storytellerModel.ProjectContentTypeImage {
		pageExists := false
		for _, page := range mustParseImageContent(story.LatestContent).Pages {
			if page.ID == lineID {
				pageExists = true
				break
			}
		}
		if !pageExists {
			return nil, errors.New("page not found in this episode")
		}
		if existing, err := s.repo.StoryBookmark(userID, story.ID, nil, lineID); err == nil {
			return existing, nil
		}
		row := &storytellerModel.StoryBookmark{UserID: userID, StoryID: story.ID, LineID: lineID}
		if err := s.repo.CreateStoryBookmark(row); err != nil {
			return nil, err
		}
		return row, nil
	}

	latest, err := s.repo.LatestStoryVersion(story.ID)
	if err != nil {
		return nil, err
	}
	if latest.ID != versionID {
		return nil, errors.New("只能對最新版本加入書籤")
	}
	if existing, err := s.repo.StoryBookmark(userID, story.ID, &versionID, lineID); err == nil {
		return existing, nil
	}
	row := &storytellerModel.StoryBookmark{
		UserID:         userID,
		StoryID:        story.ID,
		StoryVersionID: &versionID,
		LineID:         lineID,
	}
	if err := s.repo.CreateStoryBookmark(row); err != nil {
		return nil, err
	}
	return row, nil
}

func (s *Service) DeleteStoryBookmark(userID uint64, projectPublicID, storyPublicID, lineID string, versionID uint64) error {
	story, err := s.publicPublishedStory(userID, projectPublicID, storyPublicID)
	if err != nil {
		return err
	}
	if story.ContentType == storytellerModel.ProjectContentTypeImage {
		return s.repo.DeleteStoryBookmark(userID, story.ID, nil, lineID)
	}
	return s.repo.DeleteStoryBookmark(userID, story.ID, &versionID, lineID)
}

// mustParseImageContent 解析失敗時回傳空內容而不是錯誤——書籤查詢/校驗刻意用寬鬆處理，
// 遇到壞掉的舊資料只當作「這頁找不到了」，不要讓整個書籤列表／加書籤動作直接炸掉。
func mustParseImageContent(rawContent string) storytellerModel.StoryImageContent {
	var content storytellerModel.StoryImageContent
	if strings.TrimSpace(rawContent) == "" {
		return content
	}
	_ = json.Unmarshal([]byte(rawContent), &content)
	return content
}

func (s *Service) Lores(userID uint64, projectPublicID string) ([]storytellerModel.Lore, error) {
	project, err := s.repo.ProjectByPublicIDForUser(userID, projectPublicID)
	if err != nil {
		return nil, err
	}
	rows, err := s.repo.Lores(project.ID)
	if err != nil {
		return nil, err
	}
	return rows, s.fillLoreCollectionPublicIDs(project.ID, rows)
}

// LoresPage 的分頁語意跟 StoriesPage 一樣。
func (s *Service) LoresPage(userID uint64, projectPublicID, collectionPublicID string, page, pageSize int) ([]storytellerModel.Lore, int64, error) {
	if page < 1 {
		page = 1
	}
	if pageSize < 1 {
		pageSize = 20
	}
	if pageSize > 100 {
		pageSize = 100
	}
	project, err := s.repo.ProjectByPublicIDForUser(userID, projectPublicID)
	if err != nil {
		return nil, 0, err
	}
	collectionID, uncategorizedOnly, err := s.resolveLoreCollectionFilter(project.ID, collectionPublicID)
	if err != nil {
		return nil, 0, err
	}
	rows, total, err := s.repo.LoresPage(project.ID, collectionID, uncategorizedOnly, (page-1)*pageSize, pageSize)
	if err != nil {
		return nil, 0, err
	}
	return rows, total, s.fillLoreCollectionPublicIDs(project.ID, rows)
}

func (s *Service) Lore(userID uint64, projectPublicID, lorePublicID string) (*storytellerModel.Lore, error) {
	project, err := s.repo.ProjectByPublicIDForUser(userID, projectPublicID)
	if err != nil {
		return nil, err
	}
	row, err := s.repo.Lore(project.ID, lorePublicID)
	if err != nil {
		return nil, err
	}
	return row, s.fillLoreCollectionPublicID(project.ID, row)
}

func (s *Service) CreateLore(userID uint64, projectPublicID string, input storytellerModel.LoreRequest, source string) (*storytellerModel.Lore, error) {
	if err := validateLore(input); err != nil {
		return nil, err
	}
	project, err := s.repo.ProjectByPublicIDForUser(userID, projectPublicID)
	if err != nil {
		return nil, err
	}
	if err := s.validateMarkdownAssetReferences(project.ID, input.Content); err != nil {
		return nil, err
	}
	input.Content = backfillStoryMarkerIds(input.Content)
	var collectionID *uint64
	if input.CollectionID != nil {
		collectionID, err = s.resolveLoreCollectionID(project.ID, *input.CollectionID)
		if err != nil {
			return nil, err
		}
	}
	lore := &storytellerModel.Lore{
		PublicID:      randomID(),
		ProjectID:     project.ID,
		CollectionID:  collectionID,
		Title:         strings.TrimSpace(input.Title),
		LatestContent: input.Content,
		WordCount:     wordCount(input.Content),
	}
	version := buildLoreVersion(*lore, source)
	if err := s.repo.CreateLoreWithVersion(lore, version); err != nil {
		return nil, err
	}
	if err := s.syncMarkdownAssetReferences(project.ID, assetReferenceTargetLore, lore.ID, lore.LatestVersionID, lore.LatestContent); err != nil {
		return nil, err
	}
	if err := s.fillLoreCollectionPublicID(project.ID, lore); err != nil {
		return nil, err
	}
	return lore, nil
}

// UpdateLore 的 conflicted 語意跟 UpdateStory 一樣：只是提示旗標，不會拒絕寫入。
func (s *Service) UpdateLore(userID uint64, projectPublicID, lorePublicID string, input storytellerModel.LoreRequest, source string) (lore *storytellerModel.Lore, conflicted bool, err error) {
	if err := validateLore(input); err != nil {
		return nil, false, err
	}
	project, err := s.repo.ProjectByPublicIDForUser(userID, projectPublicID)
	if err != nil {
		return nil, false, err
	}
	if err := s.validateMarkdownAssetReferences(project.ID, input.Content); err != nil {
		return nil, false, err
	}
	input.Content = backfillStoryMarkerIds(input.Content)
	lore, err = s.repo.Lore(project.ID, lorePublicID)
	if err != nil {
		return nil, false, err
	}
	if input.CollectionID != nil {
		collectionID, err := s.resolveLoreCollectionID(project.ID, *input.CollectionID)
		if err != nil {
			return nil, false, err
		}
		lore.CollectionID = collectionID
	}
	lore.Title = strings.TrimSpace(input.Title)
	lore.LatestContent = input.Content
	lore.WordCount = wordCount(input.Content)
	version := buildLoreVersion(*lore, source)
	conflicted, err = s.repo.UpdateLoreWithVersion(lore, version, input.BaseVersionID)
	if err != nil {
		return nil, false, err
	}
	if err := s.syncMarkdownAssetReferences(project.ID, assetReferenceTargetLore, lore.ID, lore.LatestVersionID, lore.LatestContent); err != nil {
		return nil, false, err
	}
	if err := s.fillLoreCollectionPublicID(project.ID, lore); err != nil {
		return nil, false, err
	}
	return lore, conflicted, nil
}

// RevertLore 的邏輯跟 RevertStory 一樣：把設定集內容回復到某個舊版本，
// 當成一次新的存檔寫入，新版本記下 RevertedFromVersionID。
func (s *Service) RevertLore(userID uint64, projectPublicID, lorePublicID string, targetVersionID uint64, source string) (*storytellerModel.Lore, error) {
	project, err := s.repo.ProjectByPublicIDForUser(userID, projectPublicID)
	if err != nil {
		return nil, err
	}
	lore, err := s.repo.Lore(project.ID, lorePublicID)
	if err != nil {
		return nil, err
	}
	target, err := s.repo.LoreVersion(lore.ID, targetVersionID)
	if err != nil {
		return nil, err
	}
	lore.Title = target.Title
	lore.LatestContent = target.Content
	if err := s.validateMarkdownAssetReferences(project.ID, lore.LatestContent); err != nil {
		return nil, err
	}
	lore.WordCount = target.WordCount
	version := buildLoreVersion(*lore, source)
	version.RevertedFromVersionID = &target.ID
	if _, err := s.repo.UpdateLoreWithVersion(lore, version, nil); err != nil {
		return nil, err
	}
	if err := s.syncMarkdownAssetReferences(project.ID, assetReferenceTargetLore, lore.ID, lore.LatestVersionID, lore.LatestContent); err != nil {
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
	if err := s.repo.DeleteLore(lore); err != nil {
		return err
	}
	return s.repo.ReplaceAssetReferences(assetReferenceTargetLore, lore.ID, nil)
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

func (s *Service) StoryAgenticChat(userID uint64, projectPublicID, storyPublicID string, chatID uint64) (*storytellerModel.AgenticChatResponse, error) {
	story, err := s.storyForUserProject(userID, projectPublicID, storyPublicID)
	if err != nil {
		return nil, err
	}
	return s.repo.StoryAgenticChat(story.ID, chatID)
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

func (s *Service) LoreAgenticChat(userID uint64, projectPublicID, lorePublicID string, chatID uint64) (*storytellerModel.AgenticChatResponse, error) {
	lore, err := s.loreForUserProject(userID, projectPublicID, lorePublicID)
	if err != nil {
		return nil, err
	}
	return s.repo.LoreAgenticChat(lore.ID, chatID)
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
	projectCount, storyCount, imageStoryCount, ratingCount, followerCount, averageRating, err := s.repo.PublicAuthorSummary(profile.UserID)
	if err != nil {
		return nil, 0, nil, err
	}
	author := &storytellerModel.FavoriteAuthorOutput{
		UserProfileOutput: *userProfileOutput(profile),
		ProjectCount:      projectCount,
		StoryCount:        storyCount,
		ImageStoryCount:   imageStoryCount,
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
	if err := validateAutoSaveIntervalMinutes(input.AutoSaveIntervalMinutes); err != nil {
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
		profile.AutoSaveEnabled = input.AutoSaveEnabled
		profile.AutoSaveIntervalMinutes = input.AutoSaveIntervalMinutes
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
		UserID:                  userID,
		PenName:                 input.PenName,
		Bio:                     input.Bio,
		UseDefaultAvatar:        input.UseDefaultAvatar,
		AvatarURL:               avatarURL,
		SNSLinks:                input.SNSLinks,
		HideFavoriteProjects:    input.HideFavoriteProjects,
		HideFavoriteAuthors:     input.HideFavoriteAuthors,
		AutoSaveEnabled:         input.AutoSaveEnabled,
		AutoSaveIntervalMinutes: input.AutoSaveIntervalMinutes,
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
	var volumes []storytellerModel.Story
	if includeDraftStories {
		volumes, err = s.repo.Volumes(project.ID)
	} else {
		volumes, err = s.repo.PublishedVolumes(project.ID)
	}
	if err != nil {
		return nil, err
	}
	output.Volumes = volumes
	author, err := s.authorOutput(project.UserID)
	if err != nil {
		return nil, err
	}
	output.Author = &storytellerModel.ProjectAuthorOutput{UserProfileOutput: *author}
	return output, nil
}

// projectOutputWithFollowerCount 只給故事閱讀頁用：在共用的 projectOutput 之外，
// 多補一次作者收藏數。放在這裡而不是塞進 projectOutput 本身，是因為 projectOutput
// 也被專案列表／編輯頁共用，那些地方一次要組多筆，不需要也不該為每筆都多跑一次查詢。
func (s *Service) projectOutputWithFollowerCount(project *storytellerModel.Project, includeDraftStories bool) (*storytellerModel.ProjectOutput, error) {
	output, err := s.projectOutput(project, includeDraftStories)
	if err != nil {
		return nil, err
	}
	if output.Author != nil {
		followerCount, err := s.repo.AuthorFollowerCount(project.UserID)
		if err != nil {
			return nil, err
		}
		output.Author.FollowerCount = &followerCount
	}
	return output, nil
}

func (s *Service) signProjectOutputAssetURIs(projectID uint64, output *storytellerModel.ProjectOutput) error {
	for i := range output.Stories {
		if output.Stories[i].ContentType == storytellerModel.ProjectContentTypeImage {
			continue
		}
		content, err := s.signAssetURIsInContent(projectID, output.Stories[i].LatestContent)
		if err != nil {
			return err
		}
		output.Stories[i].LatestContent = content
	}
	return nil
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
	projectCount, storyCount, imageStoryCount, ratingCount, followerCount, averageRating, err := s.repo.PublicAuthorSummary(userID)
	if err != nil {
		return nil, err
	}
	return &storytellerModel.FavoriteAuthorOutput{
		UserProfileOutput: *author,
		ProjectCount:      projectCount,
		StoryCount:        storyCount,
		ImageStoryCount:   imageStoryCount,
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
		UserID:                  userID,
		UseDefaultAvatar:        true,
		AutoSaveEnabled:         true,
		AutoSaveIntervalMinutes: autoSaveIntervalMinutesDefault,
	}
}

func userProfileOutput(profile *storytellerModel.UserProfile) *storytellerModel.UserProfileOutput {
	return &storytellerModel.UserProfileOutput{
		UserID:                  profile.UserID,
		PenName:                 profile.PenName,
		Bio:                     profile.Bio,
		UseDefaultAvatar:        profile.UseDefaultAvatar,
		AvatarURL:               resolvedAvatarURL(profile.UserID, profile.AvatarURL),
		SNSLinks:                profile.SNSLinks,
		HideFavoriteProjects:    profile.HideFavoriteProjects,
		HideFavoriteAuthors:     profile.HideFavoriteAuthors,
		AutoSaveEnabled:         profile.AutoSaveEnabled,
		AutoSaveIntervalMinutes: profile.AutoSaveIntervalMinutes,
		CreatedAt:               profile.CreatedAt,
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

func validateAutoSaveIntervalMinutes(minutes int) error {
	if minutes < autoSaveIntervalMinutesMin || minutes > autoSaveIntervalMinutesMax {
		return fmt.Errorf("auto_save_interval_minutes 必須介於 %d 到 %d 分鐘之間", autoSaveIntervalMinutesMin, autoSaveIntervalMinutesMax)
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

func buildStoryVersion(story storytellerModel.Story, source string) *storytellerModel.StoryVersion {
	return &storytellerModel.StoryVersion{
		StoryID:   story.ID,
		Title:     story.Title,
		Summary:   story.Summary,
		Content:   story.LatestContent,
		Source:    source,
		WordCount: story.WordCount,
	}
}

func buildLoreVersion(lore storytellerModel.Lore, source string) *storytellerModel.LoreVersion {
	return &storytellerModel.LoreVersion{
		LoreID:    lore.ID,
		Title:     lore.Title,
		Content:   lore.LatestContent,
		Source:    source,
		WordCount: lore.WordCount,
	}
}

// wordCount 只算段落實際會顯示給讀者看的文字：拿掉標題前綴、段落 marker（含 align/comment/
// commentColor 屬性）、行內樣式 delimiter，不然這些系統語法（尤其是 marker 裡兩個 36 碼的
// markerId UUID）會把字數嚴重灌水。邏輯對應前端 StoryEditor.tsx／LoreEditor.tsx 用
// parseMarkdownToParagraphs 取 runs 文字的字數公式，確保編輯中即時字數跟存檔後版本字數一致。
//
// 腳注內文另外用 extractFootnoteWordCount 算好之後併入總數——腳注內文躺在行內 marker 的
// note 屬性值裡，會被上面逐行的 stripStoryInlineMarkers 整段丟掉，不會重複計算。
func wordCount(content string) uint {
	var builder strings.Builder
	for _, line := range strings.Split(content, "\n") {
		if _, rowText, ok := parseStoryTableMarker(line); ok {
			builder.WriteString(stripStoryTableRowContent(rowText, "", ""))
			continue
		}
		_, _, clean := splitHeadingAndMarkerContent(line)
		clean = stripStoryInlineMarkers(clean)
		clean = markdownImagePattern.ReplaceAllString(clean, "")
		builder.WriteString(stripDelimitersFrom(clean, wordCountInlineDelimiters))
	}
	normalized := whitespaceRegexp.ReplaceAllString(builder.String(), "")
	return uint(len([]rune(normalized))) + extractFootnoteWordCount(content)
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
	if input.ContentType == "" {
		input.ContentType = storytellerModel.ProjectContentTypeText
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
	switch input.ContentType {
	case storytellerModel.ProjectContentTypeText, storytellerModel.ProjectContentTypeImage:
	default:
		return fmt.Errorf("invalid content_type")
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
	if input.ContentType == "" {
		input.ContentType = storytellerModel.ProjectContentTypeText
	}
	return input
}

// storyWordCount 只對文字故事做字數統計；image 類型的 content 是 JSON（見
// StoryImageContent），拿去跑文字解析邏輯只會得到沒有意義的數字。
func storyWordCount(contentType storytellerModel.ProjectContentType, content string) uint {
	if contentType == storytellerModel.ProjectContentTypeImage {
		return 0
	}
	return wordCount(content)
}

func normalizeVolumeRequest(input storytellerModel.StoryVolumeRequest) storytellerModel.StoryVolumeRequest {
	if input.Status == "" {
		input.Status = storytellerModel.StoryStatusCompleted
	}
	if input.ContentType == "" {
		input.ContentType = storytellerModel.ProjectContentTypeText
	}
	input.Summary = strings.TrimSpace(input.Summary)
	return input
}

const (
	autoSaveIntervalMinutesDefault = 5
	autoSaveIntervalMinutesMin     = 2
	autoSaveIntervalMinutesMax     = 60
)

func normalizeUserProfileRequest(input storytellerModel.UserProfileRequest) storytellerModel.UserProfileRequest {
	input.PenName = strings.TrimSpace(input.PenName)
	input.Bio = strings.TrimSpace(input.Bio)
	input.AvatarURL = strings.TrimSpace(input.AvatarURL)
	if input.UseDefaultAvatar {
		input.AvatarURL = ""
	}
	if input.AutoSaveIntervalMinutes == 0 {
		input.AutoSaveIntervalMinutes = autoSaveIntervalMinutesDefault
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

// validateAgent 驗證 Agent 設定。provider/model_name/provider_apikey_id 三欄位
// 已經跟 Agent 的人設剝離——AI 助理面板改用 key／model chip 讓使用者每次呼叫時
// 自行指定，Agent 管理頁不再收集這三個欄位（見 Phase1至7工作項規劃.md Phase 8
// 後續）。欄位本身仍保留在資料表跟這個 struct 上（沒有 migration，向下相容舊
// 資料），所以這裡只在 input.Provider 有值時才驗證成組——留空整組略過即可。
func (s *Service) validateAgent(input storytellerModel.AgentRequest, requireAPIKey bool) (*storytellerModel.AgentProviderModels, error) {
	if strings.TrimSpace(input.Name) == "" {
		return nil, errors.New("name is required")
	}
	if strings.TrimSpace(string(input.Provider)) == "" {
		return nil, nil
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

// normalizeAgentName 除了裁頭尾空白，還把內部連續空白（例如不小心打了兩個空格）
// 收斂成單一空格——Agent 名稱同時是 AI 助理裡 /<名稱> slash 指令要逐字比對的
// 目標字串（見 StorytellerAgenticPanel.tsx 的 matchAgentNameCommand），內部空白
// 不一致會讓「看起來一樣」的名稱打指令卻打不中，很難肉眼發現。
func normalizeAgentName(name string) string {
	return strings.Join(strings.Fields(name), " ")
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
		storytellerModel.AgentRunModeCustomSelection,
		storytellerModel.AgentRunModeContinueChapter:
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

func buildAgentRunPrompts(agent storytellerModel.Agent, input storytellerModel.AgentRunRequest, projectPublicID string, target agentRunTarget, useTools bool) (string, string) {
	systemPrompt := strings.TrimSpace(`You are Storyteller's writing assistant. Help the user process story text.

Rules:`)
	if !input.IgnoreAgentPersona {
		systemPrompt += "\n- Follow the purpose, tone, and constraints configured for this Agent."
	}
	systemPrompt += `
- Unless the user asks for analysis, output content that can be placed directly back into the story.
- Do not include unrelated prefaces, conclusions, or explanations.
- Do not store, disclose, or request sensitive information.`
	if useTools {
		systemPrompt += `
- You may call the provided read-only tools to resolve extra @ references, but you cannot write, delete,
  move, revert, or otherwise persist changes.
- Every tool call must use the project_public_id given below — you have no access to any other project.
- Only resolve a reference if the task actually needs its content; don't fetch every reference reflexively.`
	}
	if !input.IgnoreAgentPersona {
		systemPrompt += "\n\nAgent default configuration:\n" + strings.TrimSpace(agent.DefaultPrompt)
	}
	systemPrompt += "\n\nAuthorized project_public_id for this skill run: " + projectPublicID
	if strings.TrimSpace(target.PublicID) != "" {
		if target.Kind == agenticQueryCurrentTargetLore {
			systemPrompt += "\nCurrent lore (what \"@thisLore\" refers to): lore_public_id=" + target.PublicID
		} else {
			systemPrompt += "\nCurrent story (what \"@thisStory\" refers to): story_public_id=" + target.PublicID
		}
		if strings.TrimSpace(target.Title) != "" {
			systemPrompt += ", title=" + target.Title
		}
	}
	if useTools {
		systemPrompt += `

Reference syntax — the user's instruction or reference summary may contain @ references that you should
resolve with read-only tools when needed:
- "@thisStory" means the story currently open in the editor.
- "@thisLore" means the lore/worldbuilding entry currently open in the editor.
- "@story:<title>" or "@story:[title]" refers to a story by title; call storyteller_list_stories first, then
  storyteller_get_story.
- "@lore:<title>" or "@lore:[title]" refers to a lore/worldbuilding entry by title; call storyteller_list_lores
  first, then storyteller_get_lore.`
	}

	sections := []string{
		"Task mode:\n" + string(input.Mode),
		"User instruction:\n" + agentRunPromptInstruction(input.Instruction),
	}
	hasSelection := agentRunModeRequiresSelection(input.Mode) && strings.TrimSpace(input.SelectedContent) != ""
	fullContent, referenceSummary := agentRunPromptFullContent(input.FullContent, useTools)
	if !hasSelection && fullContent != "" {
		sections = append(sections, "User's current unsaved editor content:\n<<<STORY_EDITOR_CONTENT\n"+fullContent+"\nSTORY_EDITOR_CONTENT")
	}
	if hasSelection {
		sections = append(sections, "User's current selected text from the editor (unsaved; use this exact text, do not refetch it):\n<<<STORY_SELECTED_CONTENT\n"+input.SelectedContent+"\nSTORY_SELECTED_CONTENT")
	}
	if referenceSummary != "" {
		sections = append(sections, "Extra @ references available through read-only tools (fetch only when needed):\n"+referenceSummary)
	}
	sections = append(sections, "Output requirements:\n"+agentRunOutputInstruction(input.Mode))
	return systemPrompt, strings.Join(sections, "\n\n")
}

func agentRunPromptFullContent(content string, useTools bool) (string, string) {
	content = strings.TrimSpace(content)
	if content == "" || !useTools {
		return content, ""
	}
	lines := strings.Split(content, "\n")
	kept := make([]string, 0, len(lines))
	references := make([]string, 0)
	for i := 0; i < len(lines); i++ {
		line := strings.TrimSpace(lines[i])
		if !(strings.HasPrefix(line, "Reference story:") || strings.HasPrefix(line, "Reference lore:")) {
			kept = append(kept, lines[i])
			continue
		}
		referenceLine := line
		tokenLine := ""
		if i+1 < len(lines) && strings.HasPrefix(strings.TrimSpace(lines[i+1]), "Token: @") {
			tokenLine = strings.TrimSpace(lines[i+1])
			i++
		}
		if i+1 < len(lines) && agentRunReferenceFenceStart(strings.TrimSpace(lines[i+1])) {
			i += 2
			for i < len(lines) && !agentRunReferenceFenceEnd(strings.TrimSpace(lines[i])) {
				i++
			}
		}
		if tokenLine == "" {
			kept = append(kept, referenceLine)
			continue
		}
		references = append(references, "- "+referenceLine+" / "+tokenLine)
	}
	return strings.TrimSpace(strings.Join(kept, "\n")), strings.Join(references, "\n")
}

func agentRunReferenceFenceStart(line string) bool {
	return line == "<<<STORY_REFERENCE_CONTENT" || line == "<<<LORE_REFERENCE_CONTENT"
}

func agentRunReferenceFenceEnd(line string) bool {
	return line == "STORY_REFERENCE_CONTENT" || line == "LORE_REFERENCE_CONTENT"
}

func agentRunPromptInstruction(instruction string) string {
	value := strings.TrimSpace(instruction)
	if value == "" {
		return "(No additional instruction was provided.)"
	}
	return value
}

// skill 呼叫（/rewrite 等）一律單輪、同步跑完才存檔，user／assistant 兩則訊息
// 一次寫入（見 CreateStoryChatWithMessages），沒有 agentic query 那種「先存問題、
// 等 provider 回應才補回覆」的 pending 階段，所以直接標 completed——不能留空字串，
// 那不是 StoryChatStatus 這個 ENUM 欄位認得的值。
func buildAgentRunChat(userID, storyID uint64, agent storytellerModel.Agent, input storytellerModel.AgentRunRequest, output *storytellerModel.AgentRunResponse, rawResponses []string) (*storytellerModel.StoryChat, []storytellerModel.StoryChatMessage) {
	chat := &storytellerModel.StoryChat{
		StoryID: &storyID,
		AgentID: agent.ID,
		UserID:  userID,
		Status:  storytellerModel.StoryChatStatusCompleted,
	}
	return chat, buildAgentRunMessages(agent, input, output, rawResponses)
}

func buildLoreAgentRunChat(userID, loreID uint64, agent storytellerModel.Agent, input storytellerModel.AgentRunRequest, output *storytellerModel.AgentRunResponse, rawResponses []string) (*storytellerModel.StoryChat, []storytellerModel.StoryChatMessage) {
	chat := &storytellerModel.StoryChat{
		LoreID:  &loreID,
		AgentID: agent.ID,
		UserID:  userID,
		Status:  storytellerModel.StoryChatStatusCompleted,
	}
	return chat, buildAgentRunMessages(agent, input, output, rawResponses)
}

// buildAgentRunMessages 的 rawResponses 可能是單次 Generate 的原始 response，也可能
// 是 tool loop 每一輪 provider response；一律用 rawProviderResponseJSON 存成陣列，
// 跟 agentic query 的除錯欄位保持同一種封裝格式。
func buildAgentRunMessages(agent storytellerModel.Agent, input storytellerModel.AgentRunRequest, output *storytellerModel.AgentRunResponse, rawResponses []string) []storytellerModel.StoryChatMessage {
	agentID := agent.ID
	return []storytellerModel.StoryChatMessage{
		{
			AgentID:  &agentID,
			Role:     storytellerModel.ChatMessageRoleUser,
			Content:  agentRunUserMessageContent(input),
			Metadata: agentRunInputMetadata(input),
		},
		{
			AgentID:             &agentID,
			Role:                storytellerModel.ChatMessageRoleAssistant,
			Content:             output.Result,
			Metadata:            agentRunOutputMetadata(output),
			RawProviderResponse: rawProviderResponseJSON(rawResponses),
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
	default:
		return "Follow the user instruction."
	}
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
	switch input.ContentType {
	case storytellerModel.ProjectContentTypeText, storytellerModel.ProjectContentTypeImage:
	default:
		return fmt.Errorf("invalid content_type")
	}
	return nil
}

func validateVolume(input storytellerModel.StoryVolumeRequest) error {
	if strings.TrimSpace(input.Title) == "" {
		return errors.New("title is required")
	}
	switch input.Status {
	case storytellerModel.StoryStatusDraft, storytellerModel.StoryStatusCompleted:
	default:
		return fmt.Errorf("invalid status")
	}
	switch input.ContentType {
	case storytellerModel.ProjectContentTypeText, storytellerModel.ProjectContentTypeImage:
	default:
		return fmt.Errorf("invalid content_type")
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
