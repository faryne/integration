package storyteller

import (
	"encoding/json"
	"errors"
	"strings"

	storytellerModel "faryne.dev/model/entity/storyteller"
)

// ErrAgentProposalPreviewUnsupported 代表這筆提案的工具不是「局部改內容」類，沒有
// 預覽可算：upsert 類前端直接拿參數就能畫 diff，刪除/搬移/回退本來就走危險操作確認。
// 章節寫入工具只給外部 MCP 用（見 StorytellerMCPOnlyToolRegistry），不會變成提案。
var ErrAgentProposalPreviewUnsupported = errors.New("this proposal tool has no content preview")

// proposalPreviewDoc 是預覽計算時的目標文件狀態，各工具的 previewer 直接改寫它。
type proposalPreviewDoc struct {
	Title       string
	Summary     string
	Content     string
	ContentType storytellerModel.ProjectContentType
}

// proposalPreviewers 列出支援預覽的工具。都只呼叫該工具 handler 本來就在用的純函式
// （patch 合併、search/replace），確保預覽跟真的套用算出來的內容一致。Story／Lore 的參數
// 欄位名稱相同，共用同一個 previewer；lore 沒有 ContentType，零值會走一般文字路徑，
// 跟 lore handler 的 replaceAllCounting 結果一樣。
var proposalPreviewers = map[string]func(doc *proposalPreviewDoc, arguments map[string]interface{}) error{
	"storyteller_patch_story":          previewPatch,
	"storyteller_patch_lore":           previewPatch,
	"storyteller_search_replace_story": previewSearchReplace,
	"storyteller_search_replace_lore":  previewSearchReplace,
}

// PreviewAgentProposal 算出某筆提案「套用之後」目標故事/設定集的標題、摘要、內容，
// 不寫入任何東西。req 有帶的欄位（編輯區目前的值）優先，沒帶就用 DB 最新版本。
func (s *Service) PreviewAgentProposal(userID uint64, projectPublicID, proposalPublicID string, req storytellerModel.AgentProposalPreviewRequest) (*storytellerModel.AgentProposalPreviewResponse, error) {
	project, err := s.repo.ProjectByPublicIDForUser(userID, projectPublicID)
	if err != nil {
		return nil, err
	}
	proposal, err := s.repo.AgentProposalByPublicIDForUserProject(userID, project.ID, proposalPublicID)
	if err != nil {
		return nil, err
	}
	toolName := strings.TrimSpace(proposal.ToolName)
	preview, ok := proposalPreviewers[toolName]
	if !ok {
		return nil, ErrAgentProposalPreviewUnsupported
	}
	var arguments map[string]interface{}
	if err := json.Unmarshal([]byte(proposal.Arguments), &arguments); err != nil {
		return nil, err
	}

	// 目標一律用 URL 上的專案去查（跟套用時 ScopeToolsToProject 的效果一致），順便驗證擁有權。
	var doc proposalPreviewDoc
	if strings.Contains(toolName, "_lore") {
		lorePublicID, _ := arguments["lore_public_id"].(string)
		lore, err := s.Lore(userID, projectPublicID, lorePublicID)
		if err != nil {
			return nil, err
		}
		doc = proposalPreviewDoc{Title: lore.Title, Content: lore.LatestContent}
	} else {
		storyPublicID, _ := arguments["story_public_id"].(string)
		story, err := s.Story(userID, projectPublicID, storyPublicID)
		if err != nil {
			return nil, err
		}
		doc = proposalPreviewDoc{Title: story.Title, Summary: story.Summary, Content: story.LatestContent, ContentType: story.ContentType}
	}
	doc.Title = derefStringOr(req.Title, doc.Title)
	doc.Summary = derefStringOr(req.Summary, doc.Summary)
	doc.Content = derefStringOr(req.Content, doc.Content)

	if err := preview(&doc, arguments); err != nil {
		return nil, err
	}
	return &storytellerModel.AgentProposalPreviewResponse{Title: doc.Title, Summary: doc.Summary, Content: doc.Content}, nil
}

func derefStringOr(value *string, fallback string) string {
	if value == nil {
		return fallback
	}
	return *value
}

// previewPatch 對應 mergeStoryPatch／mergeLorePatch 裡會影響 diff 的欄位；lore 參數
// 沒有 summary，解出來是 nil，自然維持原值。
func previewPatch(doc *proposalPreviewDoc, arguments map[string]interface{}) error {
	var args storytellerPatchStoryArguments
	if err := decodeArguments(arguments, &args); err != nil {
		return err
	}
	doc.Title = derefStringOr(args.Title, doc.Title)
	doc.Summary = derefStringOr(args.Summary, doc.Summary)
	doc.Content = derefStringOr(args.Content, doc.Content)
	return nil
}

func previewSearchReplace(doc *proposalPreviewDoc, arguments map[string]interface{}) error {
	var args storytellerSearchReplaceStoryArguments
	if err := decodeArguments(arguments, &args); err != nil {
		return err
	}
	pattern, err := compileStorytellerSearchPattern(args.Search, args.IsRegex)
	if err != nil {
		return err
	}
	result, err := replaceStoryContent(doc.ContentType, doc.Content, pattern, args.Replace)
	if err != nil {
		return err
	}
	doc.Content = result.Content
	return nil
}
