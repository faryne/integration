package main

import (
	"context"
	"errors"
	"fmt"
	"net/http"

	"faryne.dev/apps/steamloom/writer/internal/agent"
	"faryne.dev/apps/steamloom/writer/internal/api"
)

type proposalSource interface {
	Document(context.Context, string, api.DocumentKind, string) (*api.Document, error)
	VersionDetail(context.Context, string, api.DocumentKind, string, string) (*api.VersionDetail, error)
}

// proposalSourceError 只把 4xx（Agent 給錯目標或版本）當成可請 Agent 修正的錯誤；
// 登入失效、權限、限流、連線與伺服器錯誤直接失敗，不白白多跑一輪 Agent。
func proposalSourceError(err error) error {
	var response *api.ResponseError
	if errors.As(err, &response) && response.StatusCode >= 400 && response.StatusCode < 500 &&
		response.StatusCode != http.StatusUnauthorized && response.StatusCode != http.StatusForbidden && response.StatusCode != http.StatusTooManyRequests {
		return agent.InvalidProposal(err)
	}
	return err
}

func (a *App) prepareProposal(ctx context.Context, projectID string, items []agent.ProposalItem) ([]agent.ProposalItem, error) {
	return prepareProposalItems(ctx, a.api, projectID, items)
}

// prepareProposalItems 以 Writer REST API 的資料建立 diff 基準，不能信任 Agent 自行重建的 snapshot。
func prepareProposalItems(ctx context.Context, source proposalSource, projectID string, items []agent.ProposalItem) ([]agent.ProposalItem, error) {
	for index := range items {
		item := &items[index]
		proposalType := item.ProposalType
		if proposalType == "" {
			proposalType = agent.ProposalTypeDocumentCreate
			if item.Kind == agent.ProposalKindAsset {
				proposalType = agent.ProposalTypeAssetUpload
			} else if item.TargetID != "" {
				proposalType = agent.ProposalTypeDocumentReplace
			}
			item.ProposalType = proposalType
		}
		if item.Kind != agent.ProposalKindStory && item.Kind != agent.ProposalKindLore {
			continue
		}
		kind := api.DocumentKind(item.Kind)
		targetKey := map[string]string{agent.ProposalKindStory: "story_public_id", agent.ProposalKindLore: "lore_public_id"}[item.Kind]
		if item.TargetID == "" {
			for _, operation := range item.Operations {
				if target, ok := operation.Arguments[targetKey].(string); ok && target != "" {
					item.TargetID = target
					break
				}
			}
		}
		if item.TargetID == "" {
			continue
		}
		document, err := source.Document(ctx, projectID, kind, item.TargetID)
		if err != nil {
			return nil, proposalSourceError(fmt.Errorf("提案項目 %d：無法讀取目前內容：%w", index+1, err))
		}
		if document.LatestVersionID == nil {
			return nil, fmt.Errorf("提案項目 %d：目前內容沒有可用的版本編號", index+1)
		}
		latest := fmt.Sprint(*document.LatestVersionID)
		if item.Title == "" {
			item.Title = document.Title
		}
		if proposalType == agent.ProposalTypeChapterAppend || proposalType == agent.ProposalTypeChapterReplace {
			// 章節提案只改內文局部，文件 metadata 一律沿用 REST API 的目前值。
			item.Title, item.Summary, item.ContentType = document.Title, document.Summary, document.ContentType
		}
		if item.BaseVersionID == "" {
			item.BaseVersionID = latest
		}
		baseTitle, baseSummary, baseContent := document.Title, document.Summary, document.Content
		if item.BaseVersionID != latest {
			version, err := source.VersionDetail(ctx, projectID, kind, item.TargetID, item.BaseVersionID)
			if err != nil {
				return nil, proposalSourceError(fmt.Errorf("提案項目 %d：無法讀取基準版本 #%s：%w", index+1, item.BaseVersionID, err))
			}
			baseTitle, baseSummary, baseContent = version.Title, version.Summary, version.Content
		}
		if proposalType == agent.ProposalTypeDocumentPatch {
			// patch 只描述差異；全文由 Writer 從可信任的 base 內容算出，review 與套用都沿用全文流程。
			if item.Summary == "" {
				item.Summary = baseSummary
			}
			item.ContentType = document.ContentType
			item.Content, err = applyProposalEdits(baseContent, item.Edits)
			if err != nil {
				return nil, agent.InvalidProposal(fmt.Errorf("提案項目 %d：%w", index+1, err))
			}
		} else if proposalType == agent.ProposalTypeChapterReplace {
			spans := proposalChapterSpans(item.Content)
			if len(spans) == 0 || spans[0].StartLine != 0 || spans[0].MarkerID != item.MarkerID {
				return nil, agent.InvalidProposal(fmt.Errorf("提案項目 %d：替換章節必須以相同 marker 的 heading 開始", index+1))
			}
			baseContent, err = proposalChapterContent(baseContent, item.MarkerID)
			if err != nil {
				return nil, agent.InvalidProposal(fmt.Errorf("提案項目 %d：無法讀取要替換的章節：%w", index+1, err))
			}
		} else if proposalType == agent.ProposalTypeChapterAppend {
			spans := proposalChapterSpans(item.Content)
			if len(spans) == 0 || spans[0].StartLine != 0 || spans[0].MarkerID == "" {
				return nil, agent.InvalidProposal(fmt.Errorf("提案項目 %d：新增章節必須以帶 marker 的 heading 開始", index+1))
			}
			if item.AfterMarkerID != "" {
				baseContent, err = proposalChapterContent(baseContent, item.AfterMarkerID)
				if err != nil {
					return nil, agent.InvalidProposal(fmt.Errorf("提案項目 %d：無法讀取插入位置：%w", index+1, err))
				}
			}
		}
		item.Base = &agent.ProposalSnapshot{Title: baseTitle, Summary: baseSummary, ContentType: document.ContentType, Content: baseContent}
		for operationIndex := range item.Operations {
			arguments := item.Operations[operationIndex].Arguments
			if arguments == nil {
				return nil, agent.InvalidProposal(fmt.Errorf("提案項目 %d：寫入操作缺少參數", index+1))
			}
			if target, ok := arguments[targetKey].(string); ok && target == item.TargetID {
				if base, exists := arguments["base_version_id"]; exists && fmt.Sprint(base) != item.BaseVersionID {
					return nil, agent.InvalidProposal(fmt.Errorf("提案項目 %d：Agent 的 base_version_id 與提案基準不一致", index+1))
				}
				arguments["base_version_id"] = item.BaseVersionID
			}
		}
		if item.Base == nil {
			return nil, errors.New("Writer 無法建立提案的版本基準")
		}
	}
	return items, nil
}
