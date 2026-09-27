package storyteller

import (
	"context"
	"encoding/xml"
	"errors"
	"fmt"
	"html"
	"strconv"
	"strings"
	"time"

	storytellerModel "faryne.dev/model/entity/storyteller"
	storytellerRepo "faryne.dev/repository/storyteller"
	"faryne.dev/service/log"
	"go.uber.org/zap"
)

const (
	assistantMemoryNameMaxRunes    = 255
	assistantMemoryContentMaxRunes = 2000
	assistantMemoryFailureMessage  = "梭梭暫時沒能整理好這段對話，請稍後再試。"
	assistantMemoryStaleAfter      = 6 * time.Minute
	assistantMemoryDraftRetention  = 7 * 24 * time.Hour
	assistantMemoryTrashRetention  = 30 * 24 * time.Hour
)

var (
	ErrAssistantMemoryChatNotCompleted  = errors.New("chat must be completed before generating memory")
	ErrAssistantMemoryDraftNotReady     = errors.New("memory draft is not ready")
	ErrAssistantMemoryDraftEmpty        = errors.New("memory draft has no content to confirm")
	ErrAssistantMemoryScopeInvalid      = errors.New("memory scope is invalid for this chat")
	ErrAssistantMemoryKindInvalid       = errors.New("memory kind is invalid")
	ErrAssistantMemoryNameTooLong       = fmt.Errorf("memory_name must be %d characters or less", assistantMemoryNameMaxRunes)
	ErrAssistantMemoryContentInvalid    = fmt.Errorf("content must be between 1 and %d characters", assistantMemoryContentMaxRunes)
	ErrAssistantMemoryPriorityInvalid   = errors.New("priority must be between 0 and 100")
	ErrAssistantMemoryDraftResolved     = errors.New("memory draft was already confirmed or discarded")
	ErrAssistantMemoryProviderRequired  = errors.New("provider_apikey_id is required")
	ErrAssistantMemoryModelRequired     = errors.New("model_name is required")
	ErrAssistantMemorySupersedeConflict = storytellerRepo.ErrAssistantMemorySupersedeConflict
)

// 記憶整理使用獨立 prompt，不套梭梭的人格回覆格式；這次輸出是供程式解析的候選資料，
// 最終仍必須由使用者確認才會成為有效記憶。
const assistantMemoryGenerationSystemPrompt = `你是梭梭的記憶整理器。請從指定的一輪使用者與 AI 對話中，判斷是否有值得跨對話保留的長期資訊。

只保留一個原子、可長期使用的記憶，例如使用者偏好、持續適用的指示、已確認的創作決策，或後續工作需要知道的穩定背景。
不要記住臨時請求、AI 這輪產出的全文、一次性的操作狀態、未確認的推測、密碼、金鑰、token、個資或其他敏感資料。
若內容與 ExistingMemories 重複，或沒有值得記住的資訊，ShouldRemember 必須是 false。
若新資訊明確修正或取代一筆同 scope、且未 pinned 的既有記憶，SupersedesPublicID 填該筆 public_id；否則留空。不可取代 pinned 記憶。

Scope 的判斷：
- project：只適用目前專案，但不侷限單篇故事或設定。
- story：只適用目前故事。
- lore：只適用目前設定。
只能回傳 AllowedScopes 內的值。

Kind 只能是 preference、instruction、decision、context。Tags 是 0 到 8 個可自由整理的短標籤，每個最多 24 個字；請優先沿用 ExistingMemories 已有的標籤詞彙。
Content 必須獨立可讀，不引用「上面」「這次」「剛才」等易失去上下文的說法；最多 2000 個字。
Name 是供使用者辨識的短標題，最多 255 個字。Priority 為 0 到 100，50 代表一般重要度。

只輸出以下 XML，不要 markdown code fence、說明或其他文字：
<MemoryDraft>
  <ShouldRemember>true|false</ShouldRemember>
  <Name><![CDATA[短標題]]></Name>
  <Content><![CDATA[原子記憶內容]]></Content>
  <Scope>project|story|lore</Scope>
  <Kind>preference|instruction|decision|context</Kind>
  <Tags><Tag><![CDATA[標籤一]]></Tag><Tag><![CDATA[標籤二]]></Tag></Tags>
  <Priority>0-100</Priority>
  <SupersedesPublicID><![CDATA[要取代的 ExistingMemories public_id，否則留空]]></SupersedesPublicID>
</MemoryDraft>`

type assistantMemoryGenerationRepository interface {
	assistantMemoryRepository
	ProviderAPIKey(userID, id uint64) (*storytellerModel.ProviderAPIKey, error)
	AgentChat(userID, chatID uint64) (*storytellerModel.AgenticChatResponse, error)
	AgentChatTarget(userID, chatID uint64) (*storytellerModel.AgentChatTarget, error)
	CreateAssistantMemory(row *storytellerModel.AssistantMemory) error
	AssistantMemoryByPublicIDForUser(userID uint64, publicID string) (*storytellerModel.AssistantMemory, error)
	AgentModelPrice(provider storytellerModel.AgentProvider, modelName string) (*string, error)
	CreateAgentUsageLog(row *storytellerModel.AgentUsageLog) error
	CompleteAssistantMemoryGeneration(id uint64, name, content, tags, supersedesPublicID string, scope storytellerModel.AssistantMemoryScope, kind storytellerModel.AssistantMemoryKind, priority uint8, shouldRemember bool, usage *storytellerModel.AgentRunUsage, usageLog *storytellerModel.AgentUsageLog) error
	FailAssistantMemoryGeneration(id uint64, message string) error
	FailStaleAssistantMemoryGeneration(id uint64, updatedBefore time.Time, message string) (int64, error)
	ConfirmAssistantMemory(row *storytellerModel.AssistantMemory) (int64, error)
	DeleteAssistantMemoryDraft(userID, id uint64) (int64, error)
}

type assistantMemoryGenerationDeps struct {
	Repo            assistantMemoryGenerationRepository
	Work            agenticBackgroundWork
	ProviderFactory aiProviderFactory
}

type assistantMemoryDraftXML struct {
	ShouldRemember     string   `xml:"ShouldRemember"`
	Name               string   `xml:"Name"`
	Content            string   `xml:"Content"`
	Scope              string   `xml:"Scope"`
	Kind               string   `xml:"Kind"`
	Tags               []string `xml:"Tags>Tag"`
	Priority           string   `xml:"Priority"`
	SupersedesPublicID string   `xml:"SupersedesPublicID"`
}

type assistantMemoryCandidate struct {
	ShouldRemember     bool
	Name               string
	Content            string
	Scope              storytellerModel.AssistantMemoryScope
	Kind               storytellerModel.AssistantMemoryKind
	Tags               []string
	Priority           uint8
	SupersedesPublicID string
}

func (s *Service) assistantMemoryGenerationDeps() assistantMemoryGenerationDeps {
	return assistantMemoryGenerationDeps{Repo: s.repo, Work: agenticQueryBackgroundWork, ProviderFactory: NewAgenticAIProvider}
}

// GenerateAssistantMemory 建立一筆 in_progress 草稿後立即回應；provider 呼叫在受
// graceful shutdown 追蹤的背景工作內完成，前端再以 public_id 輪詢結果。
func (s *Service) GenerateAssistantMemory(userID, chatID uint64, in storytellerModel.AssistantMemoryGenerateRequest) (*storytellerModel.AssistantMemoryDraftOutput, error) {
	return generateAssistantMemory(s.assistantMemoryGenerationDeps(), userID, chatID, in)
}

func generateAssistantMemory(deps assistantMemoryGenerationDeps, userID, chatID uint64, in storytellerModel.AssistantMemoryGenerateRequest) (*storytellerModel.AssistantMemoryDraftOutput, error) {
	target, err := deps.Repo.AgentChatTarget(userID, chatID)
	if err != nil {
		return nil, err
	}
	project, err := deps.Repo.ProjectByPublicIDForUser(userID, target.ProjectPublicID)
	if err != nil {
		return nil, err
	}
	chat, err := deps.Repo.AgentChat(userID, chatID)
	if err != nil {
		return nil, err
	}
	if chat.ChatStatus != storytellerModel.StoryChatStatusCompleted {
		return nil, ErrAssistantMemoryChatNotCompleted
	}
	if in.ProviderAPIKeyID == nil {
		return nil, ErrAssistantMemoryProviderRequired
	}
	key, err := resolveProviderAPIKey(deps.Repo.ProviderAPIKey, userID, in.ProviderAPIKeyID)
	if err != nil {
		return nil, err
	}
	modelName := strings.TrimSpace(in.ModelName)
	if modelName == "" {
		return nil, ErrAssistantMemoryModelRequired
	}
	provider, err := deps.ProviderFactory(key.Provider, key.Endpoint)
	if err != nil {
		return nil, err
	}
	apiKey, err := decryptProviderAPIKey(key)
	if err != nil {
		return nil, err
	}

	currentScope, story, lore, err := assistantMemoryGenerationTarget(deps.Repo, project.ID, target)
	if err != nil {
		return nil, err
	}
	storyID, loreID := assistantMemoryTargetIDs(story, lore)
	memories, err := deps.Repo.ActiveAssistantMemories(userID, project.ID, storyID, loreID, assistantMemoryPromptLimit)
	if err != nil {
		return nil, err
	}
	prompt := buildAssistantMemoryGenerationPrompt(project, target, currentScope, chat.Messages, memories)
	done, err := deps.Work.Track("storyteller.assistant_memory.generate")
	if err != nil {
		return nil, ErrAgenticQueryServerDraining
	}
	row := newAssistantMemoryDraft(userID, chatID, storyID, loreID, key.ID, modelName, currentScope)
	if err := deps.Repo.CreateAssistantMemory(row); err != nil {
		done()
		return nil, err
	}
	go func() {
		defer done()
		err := completeAssistantMemoryGeneration(deps.Work.Context(), deps.Repo, provider, apiKey, modelName, row.ID, userID, chatID, key.ID, key.Provider, currentScope, prompt, memories)
		logAgenticQueryBackgroundError("storyteller assistant memory generation failed", chatID, err)
	}()
	return assistantMemoryDraftOutput(row), nil
}

func assistantMemoryGenerationTarget(repo assistantMemoryRepository, projectID uint64, target *storytellerModel.AgentChatTarget) (storytellerModel.AssistantMemoryScope, *storytellerModel.Story, *storytellerModel.Lore, error) {
	if target.Kind == string(agenticQueryCurrentTargetLore) {
		lore, err := repo.Lore(projectID, target.TargetPublicID)
		return storytellerModel.AssistantMemoryScopeLore, nil, lore, err
	}
	story, err := repo.Story(projectID, target.TargetPublicID)
	return storytellerModel.AssistantMemoryScopeStory, story, nil, err
}

func newAssistantMemoryDraft(userID, chatID uint64, storyID, loreID *uint64, keyID uint64, modelName string, scope storytellerModel.AssistantMemoryScope) *storytellerModel.AssistantMemory {
	return &storytellerModel.AssistantMemory{
		PublicID: randomID(), UserID: userID, ScopeType: scope, ProjectID: nil, StoryID: storyID, LoreID: loreID,
		SourceChatID: &chatID, ProviderAPIKeyID: &keyID, ModelName: &modelName, Status: storytellerModel.AssistantMemoryStatusInProgress,
		Kind: storytellerModel.AssistantMemoryKindContext, Content: "", Priority: 50,
	}
}

func completeAssistantMemoryGeneration(ctx context.Context, repo assistantMemoryGenerationRepository, provider AIProvider, apiKey, modelName string, memoryID, userID, chatID, providerAPIKeyID uint64, providerName storytellerModel.AgentProvider, currentScope storytellerModel.AssistantMemoryScope, prompt string, memories []storytellerModel.AssistantMemory) error {
	response, err := provider.Generate(ctx, AIProviderRequest{APIKey: apiKey, ModelName: modelName, SystemPrompt: assistantMemoryGenerationSystemPrompt, UserPrompt: prompt})
	if err != nil {
		_ = repo.FailAssistantMemoryGeneration(memoryID, assistantMemoryFailureMessage)
		return err
	}
	usage, usageLog := assistantMemoryGenerationUsage(repo, response, userID, chatID, providerAPIKeyID, providerName, modelName)
	candidate, err := parseAssistantMemoryCandidate(response.Result, currentScope)
	if err != nil {
		if usageLog != nil {
			_ = repo.CreateAgentUsageLog(usageLog)
		}
		_ = repo.FailAssistantMemoryGeneration(memoryID, assistantMemoryFailureMessage)
		return err
	}
	if sanitized, err := sanitizeAssistantMemorySupersedes(candidate, memories); err != nil {
		log.Logger().Warn("Storyteller assistant memory ignored invalid supersede suggestion",
			zap.Uint64("chat_id", chatID), zap.String("supersedes_public_id", candidate.SupersedesPublicID), zap.Error(err))
		candidate = sanitized
	}
	return repo.CompleteAssistantMemoryGeneration(memoryID, candidate.Name, candidate.Content, encodeAssistantMemoryTags(candidate.Tags), candidate.SupersedesPublicID, candidate.Scope, candidate.Kind, candidate.Priority, candidate.ShouldRemember, usage, usageLog)
}

func assistantMemoryGenerationUsage(repo assistantMemoryGenerationRepository, response *AIProviderResponse, userID, chatID, providerAPIKeyID uint64, provider storytellerModel.AgentProvider, modelName string) (*storytellerModel.AgentRunUsage, *storytellerModel.AgentUsageLog) {
	if response == nil || response.Usage == nil {
		return nil, nil
	}
	usage := &storytellerModel.AgentRunUsage{InputTokens: response.Usage.InputTokens, OutputTokens: response.Usage.OutputTokens, TotalTokens: response.Usage.TotalTokens}
	price, _ := repo.AgentModelPrice(provider, modelName)
	return usage, &storytellerModel.AgentUsageLog{UserID: userID, ProviderAPIKeyID: providerAPIKeyID, ChatID: chatID, Provider: provider, ModelName: modelName, InputTokens: usage.InputTokens, OutputTokens: usage.OutputTokens, TotalTokens: usage.TotalTokens, Price: price}
}

func buildAssistantMemoryGenerationPrompt(project *storytellerModel.Project, target *storytellerModel.AgentChatTarget, currentScope storytellerModel.AssistantMemoryScope, messages []storytellerModel.StoryChatMessageOutput, memories []storytellerModel.AssistantMemory) string {
	allowedScopes := "project," + string(currentScope)
	var b strings.Builder
	fmt.Fprintf(&b, "<MemoryGenerationRequest><Project name=\"%s\" public_id=\"%s\"/><CurrentTarget kind=\"%s\" public_id=\"%s\"/><AllowedScopes>%s</AllowedScopes><ExistingMemories>",
		html.EscapeString(project.Name), html.EscapeString(project.PublicID), html.EscapeString(target.Kind), html.EscapeString(target.TargetPublicID), allowedScopes)
	for _, memory := range memories {
		fmt.Fprintf(&b, "<Memory public_id=\"%s\" scope=\"%s\" kind=\"%s\" tags=\"%s\" pinned=\"%t\">%s</Memory>", html.EscapeString(memory.PublicID), memory.ScopeType, memory.Kind, html.EscapeString(strings.Join(decodeAssistantMemoryTags(memory.Tags), ",")), memory.IsPinned, html.EscapeString(memory.Content))
	}
	b.WriteString("</ExistingMemories><Conversation>")
	for _, message := range messages {
		if message.Role != storytellerModel.ChatMessageRoleUser && message.Role != storytellerModel.ChatMessageRoleAssistant {
			continue
		}
		fmt.Fprintf(&b, "<Message role=\"%s\">%s</Message>", message.Role, html.EscapeString(message.Content))
	}
	b.WriteString("</Conversation></MemoryGenerationRequest>")
	return b.String()
}

func parseAssistantMemoryCandidate(raw string, currentScope storytellerModel.AssistantMemoryScope) (assistantMemoryCandidate, error) {
	fragment, err := memoryDraftXMLFragment(raw)
	if err != nil {
		return assistantMemoryCandidate{}, err
	}
	var parsed assistantMemoryDraftXML
	if err := xml.Unmarshal([]byte(fragment), &parsed); err != nil {
		return assistantMemoryCandidate{}, fmt.Errorf("parse memory draft XML: %w", err)
	}
	shouldRemember, err := strconv.ParseBool(strings.TrimSpace(parsed.ShouldRemember))
	if err != nil {
		return assistantMemoryCandidate{}, errors.New("memory draft ShouldRemember is invalid")
	}
	candidate := assistantMemoryCandidate{ShouldRemember: shouldRemember, Name: strings.TrimSpace(parsed.Name), Content: strings.TrimSpace(parsed.Content), Scope: storytellerModel.AssistantMemoryScope(strings.TrimSpace(parsed.Scope)), Kind: storytellerModel.AssistantMemoryKind(strings.TrimSpace(parsed.Kind)), Priority: 50, SupersedesPublicID: strings.TrimSpace(parsed.SupersedesPublicID)}
	if !shouldRemember {
		candidate.Name, candidate.Content, candidate.SupersedesPublicID = "", "", ""
		candidate.Scope, candidate.Kind = currentScope, storytellerModel.AssistantMemoryKindContext
		return candidate, nil
	}
	if len([]rune(candidate.Name)) > assistantMemoryNameMaxRunes {
		return assistantMemoryCandidate{}, ErrAssistantMemoryNameTooLong
	}
	if len([]rune(candidate.Content)) == 0 || len([]rune(candidate.Content)) > assistantMemoryContentMaxRunes {
		return assistantMemoryCandidate{}, ErrAssistantMemoryContentInvalid
	}
	if !assistantMemoryScopeAllowed(candidate.Scope, currentScope) {
		return assistantMemoryCandidate{}, ErrAssistantMemoryScopeInvalid
	}
	if !assistantMemoryKindAllowed(candidate.Kind) {
		return assistantMemoryCandidate{}, ErrAssistantMemoryKindInvalid
	}
	candidate.Tags, err = normalizeAssistantMemoryTags(parsed.Tags)
	if err != nil {
		return assistantMemoryCandidate{}, err
	}
	if strings.TrimSpace(parsed.Priority) != "" {
		priority, err := strconv.Atoi(strings.TrimSpace(parsed.Priority))
		if err != nil || priority < 0 || priority > 100 {
			return assistantMemoryCandidate{}, errors.New("memory draft Priority is invalid")
		}
		candidate.Priority = uint8(priority)
	}
	return candidate, nil
}

func memoryDraftXMLFragment(raw string) (string, error) {
	start := strings.Index(raw, "<MemoryDraft")
	end := strings.LastIndex(raw, "</MemoryDraft>")
	if start < 0 || end < start {
		return "", errors.New("memory draft XML is missing")
	}
	return raw[start : end+len("</MemoryDraft>")], nil
}

func validateAssistantMemorySupersedes(candidate assistantMemoryCandidate, memories []storytellerModel.AssistantMemory) error {
	if !candidate.ShouldRemember || candidate.SupersedesPublicID == "" {
		return nil
	}
	for _, memory := range memories {
		if memory.PublicID == candidate.SupersedesPublicID && memory.ScopeType == candidate.Scope && !memory.IsPinned {
			return nil
		}
	}
	return ErrAssistantMemorySupersedeConflict
}

func sanitizeAssistantMemorySupersedes(candidate assistantMemoryCandidate, memories []storytellerModel.AssistantMemory) (assistantMemoryCandidate, error) {
	err := validateAssistantMemorySupersedes(candidate, memories)
	if err != nil {
		candidate.SupersedesPublicID = ""
	}
	return candidate, err
}

func assistantMemoryScopeAllowed(scope, current storytellerModel.AssistantMemoryScope) bool {
	return scope == storytellerModel.AssistantMemoryScopeProject || scope == current
}

func assistantMemoryKindAllowed(kind storytellerModel.AssistantMemoryKind) bool {
	switch kind {
	case storytellerModel.AssistantMemoryKindPreference, storytellerModel.AssistantMemoryKindInstruction, storytellerModel.AssistantMemoryKindDecision, storytellerModel.AssistantMemoryKindContext:
		return true
	default:
		return false
	}
}

func (s *Service) AssistantMemoryDraft(userID uint64, publicID string) (*storytellerModel.AssistantMemoryDraftOutput, error) {
	row, err := s.repo.AssistantMemoryByPublicIDForUser(userID, strings.TrimSpace(publicID))
	if err != nil {
		return nil, err
	}
	// 程序在 provider 回應前被重啟時 goroutine 不會回來補狀態；輪詢讀取時把超過
	// provider timeout 的孤兒草稿轉為 failed，避免畫面永久停在「整理中」。
	if row.Status == storytellerModel.AssistantMemoryStatusInProgress && row.UpdatedAt.Before(time.Now().Add(-assistantMemoryStaleAfter)) {
		affected, err := s.repo.FailStaleAssistantMemoryGeneration(row.ID, time.Now().Add(-assistantMemoryStaleAfter), assistantMemoryFailureMessage)
		if err != nil {
			return nil, err
		}
		if affected > 0 {
			row.Status, row.ErrorMessage = storytellerModel.AssistantMemoryStatusFailed, assistantMemoryStringPointer(assistantMemoryFailureMessage)
		}
	}
	output := assistantMemoryDraftOutput(row)
	if row.SupersedesPublicID != nil {
		if old, lookupErr := s.repo.AssistantMemoryByPublicIDForUser(userID, *row.SupersedesPublicID); lookupErr == nil {
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
			_, story, lore, err := assistantMemoryGenerationTarget(s.repo, project.ID, target)
			if err != nil {
				return nil, err
			}
			output.SupersededMemory = assistantMemoryOutput(*old, project, story, lore)
		}
	}
	return output, nil
}

func assistantMemoryStringPointer(value string) *string { return &value }

func assistantMemoryDraftOutput(row *storytellerModel.AssistantMemory) *storytellerModel.AssistantMemoryDraftOutput {
	return &storytellerModel.AssistantMemoryDraftOutput{
		PublicID: row.PublicID, Status: row.Status, ShouldRemember: row.ShouldRemember, MemoryName: assistantMemoryName(row.MemoryName),
		ScopeType: row.ScopeType, Kind: row.Kind, Tags: decodeAssistantMemoryTags(row.Tags), Content: row.Content, Priority: row.Priority, ErrorMessage: assistantMemoryName(row.ErrorMessage),
		SupersedesPublicID: assistantMemoryName(row.SupersedesPublicID),
	}
}

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

// RetryAssistantMemory 重新整理失敗草稿；新草稿建立成功後才丟棄舊資料，避免同步
// 驗證失敗時連原本的錯誤狀態都失去。
func (s *Service) RetryAssistantMemory(userID uint64, publicID string, in storytellerModel.AssistantMemoryGenerateRequest) (*storytellerModel.AssistantMemoryDraftOutput, error) {
	row, err := s.repo.AssistantMemoryByPublicIDForUser(userID, strings.TrimSpace(publicID))
	if err != nil {
		return nil, err
	}
	if row.Status != storytellerModel.AssistantMemoryStatusFailed || row.SourceChatID == nil {
		return nil, ErrAssistantMemoryDraftNotReady
	}
	next, err := generateAssistantMemory(s.assistantMemoryGenerationDeps(), userID, *row.SourceChatID, in)
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

type assistantMemoryDraftCleanupRepository interface {
	ExpireAssistantMemoryDrafts(updatedBefore, deletedAt time.Time) (int64, error)
	PurgeDeletedAssistantMemoryDrafts(deletedBefore time.Time) (int64, error)
}

func cleanupExpiredAssistantMemoryDrafts(repo assistantMemoryDraftCleanupRepository, now time.Time) (expired, purged int64, err error) {
	expired, err = repo.ExpireAssistantMemoryDrafts(now.Add(-assistantMemoryDraftRetention), now)
	if err != nil {
		return 0, 0, err
	}
	purged, err = repo.PurgeDeletedAssistantMemoryDrafts(now.Add(-assistantMemoryTrashRetention))
	return expired, purged, err
}

// RunCleanupAssistantMemoryDrafts 每日先 soft delete 逾期未確認草稿，再實體清除
// 已進垃圾區超過保留期的草稿；confirmed 記憶不會進入任一清理條件。
func RunCleanupAssistantMemoryDrafts() {
	expired, purged, err := cleanupExpiredAssistantMemoryDrafts(NewService().repo, time.Now())
	if err != nil {
		log.Logger().Error("Storyteller assistant memory draft cleanup failed", zap.Error(err))
		return
	}
	log.Logger().Info("Storyteller assistant memory draft cleanup completed", zap.Int64("expired", expired), zap.Int64("purged", purged))
}
