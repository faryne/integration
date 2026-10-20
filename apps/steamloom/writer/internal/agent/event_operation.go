package agent

import (
	"regexp"
	"strconv"
	"strings"
)

var (
	numberedOperationText = regexp.MustCompile(`^(新增故事|更新故事|修改故事|新增設定|更新設定|修改設定|新增章節|更新章節|上傳圖片|生成媒體|新增圖像作品|更新圖像作品)「(.*)」……第 (\d+)/(\d+) (開始|完成|失敗)(?:：(.*))?$`)
	progressDetailText    = regexp.MustCompile(`^第 (\d+)/(\d+) (?:開始|完成|失敗)(?:：(.*))?$`)
	approvedMediaText     = regexp.MustCompile(`^已核准執行：媒體生成〈(.*)〉，執行 (\d+) 次$`)
	approvedAssetsText    = regexp.MustCompile(`^已核准上傳資產：圖片〈(.*)〉，共 (\d+) 項$`)
	approvedAssetsMany    = regexp.MustCompile(`^已核准上傳資產(?: \d+ 項)?：(.*)，共 (\d+) 項$`)
	genericDecisionText   = regexp.MustCompile(`^(?:已核准套用|已否決)(?: \d+ 項)?：(.*)$`)
	decisionItemText      = regexp.MustCompile(`(故事|設定|圖片|媒體生成)〈([^〉]*)〉`)
	applyCompletedText    = regexp.MustCompile(`^Writer 已依你的核准套用 (\d+) 項提案。$`)
)

type operationIdentity struct{ proposalType, kind string }

var operationIdentityByLabel = map[string]operationIdentity{
	"新增故事":   {ProposalTypeDocumentCreate, ProposalKindStory},
	"更新故事":   {ProposalTypeDocumentReplace, ProposalKindStory},
	"修改故事":   {ProposalTypeDocumentPatch, ProposalKindStory},
	"新增設定":   {ProposalTypeDocumentCreate, ProposalKindLore},
	"更新設定":   {ProposalTypeDocumentReplace, ProposalKindLore},
	"修改設定":   {ProposalTypeDocumentPatch, ProposalKindLore},
	"新增章節":   {ProposalTypeChapterAppend, ProposalKindStory},
	"更新章節":   {ProposalTypeChapterReplace, ProposalKindStory},
	"上傳圖片":   {ProposalTypeAssetUpload, ProposalKindAsset},
	"生成媒體":   {ProposalTypeMediaBrief, ProposalKindMedia},
	"新增圖像作品": {ProposalTypeImageStoryCreate, ProposalKindStory},
	"更新圖像作品": {ProposalTypeImageStoryUpdate, ProposalKindStory},
}

// setOperationMetadata 讓前端依穩定欄位翻譯 lifecycle；Text 仍保留為舊版 Writer 的 fallback。
func setOperationMetadata(event *ChatLine, item ProposalItem) {
	event.OperationType, event.OperationKind, event.OperationTitle = item.ProposalType, item.Kind, proposalItemOperationTitle(item)
}

func proposalEventOperation(item ProposalItem) EventOperation {
	return EventOperation{ProposalType: item.ProposalType, Kind: item.Kind, Title: proposalItemOperationTitle(item), Count: 1}
}

func setProgressMetadata(event *ChatLine, detail string) {
	match := progressDetailText.FindStringSubmatch(detail)
	if match == nil {
		return
	}
	event.Current, _ = strconv.Atoi(match[1])
	event.Total, _ = strconv.Atoi(match[2])
	event.Detail = strings.TrimSpace(match[3])
}

// hydrateLegacyOperation 讓升級前已落盤的固定中文 lifecycle 也能在切換語系後正常顯示。
func hydrateLegacyOperation(event *ChatLine) {
	if event.Action == "" {
		switch event.Text {
		case "Writer 在取得套用結果前中斷；不會自動重送，請先確認內容":
			event.Action = ActionApplyInterrupted
		case "Writer 在 Worker 生成完成前中斷，可以調整參數重新生成（外部服務可能仍會完成並扣除額度）":
			event.Action = ActionMediaInterrupted
		}
	}
	if event.Detail == "" {
		event.Detail = legacyEventDetail(*event)
	}
	if event.OperationType != "" || event.Count > 0 {
		return
	}
	if match := numberedOperationText.FindStringSubmatch(event.Text); match != nil {
		identity := operationIdentityByLabel[match[1]]
		event.OperationType, event.OperationKind, event.OperationTitle = identity.proposalType, identity.kind, match[2]
		event.Current, _ = strconv.Atoi(match[3])
		event.Total, _ = strconv.Atoi(match[4])
		event.Detail = strings.TrimSpace(match[6])
		return
	}
	if match := approvedMediaText.FindStringSubmatch(event.Text); match != nil {
		event.OperationType, event.OperationKind, event.OperationTitle = ProposalTypeMediaBrief, ProposalKindMedia, match[1]
		event.Count, _ = strconv.Atoi(match[2])
		return
	}
	if match := approvedAssetsText.FindStringSubmatch(event.Text); match != nil {
		event.OperationType, event.OperationKind, event.OperationTitle = ProposalTypeAssetUpload, ProposalKindAsset, match[1]
		event.Count, _ = strconv.Atoi(match[2])
		return
	}
	if match := approvedAssetsMany.FindStringSubmatch(event.Text); match != nil {
		event.Operations = legacyDecisionOperations(match[1], ProposalTypeAssetUpload)
		event.Count, _ = strconv.Atoi(match[2])
		return
	}
	if match := genericDecisionText.FindStringSubmatch(event.Text); match != nil {
		event.Operations = legacyDecisionOperations(match[1], "")
		return
	}
	if match := applyCompletedText.FindStringSubmatch(event.Text); match != nil {
		event.Count, _ = strconv.Atoi(match[1])
	}
}

func legacyDecisionOperations(text, proposalType string) []EventOperation {
	kinds := map[string]string{"故事": ProposalKindStory, "設定": ProposalKindLore, "圖片": ProposalKindAsset, "媒體生成": ProposalKindMedia}
	matches := decisionItemText.FindAllStringSubmatch(text, -1)
	operations := make([]EventOperation, 0, len(matches))
	for _, match := range matches {
		operations = append(operations, EventOperation{ProposalType: proposalType, Kind: kinds[match[1]], Title: match[2]})
	}
	return operations
}

func legacyEventDetail(event ChatLine) string {
	prefix := ""
	switch event.Type {
	case EventTaskFailed:
		prefix = "Agent 執行失敗："
	case EventApplyFailed:
		prefix = "Writer 套用提案失敗："
	case EventApplyConflict:
		prefix = "資料已在確認後變更，Writer 未覆寫新版本："
	default:
		return ""
	}
	return strings.TrimSpace(strings.TrimPrefix(event.Text, prefix))
}
