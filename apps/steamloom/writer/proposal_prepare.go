package main

import (
	"context"
	"errors"
	"fmt"

	"faryne.dev/apps/steamloom/writer/internal/agent"
	"faryne.dev/apps/steamloom/writer/internal/api"
)

type proposalSource interface {
	Document(context.Context, string, api.DocumentKind, string) (*api.Document, error)
	VersionDetail(context.Context, string, api.DocumentKind, string, string) (*api.VersionDetail, error)
}

func (a *App) prepareProposal(ctx context.Context, projectID string, items []agent.ProposalItem) ([]agent.ProposalItem, error) {
	return prepareProposalItems(ctx, a.api, projectID, items)
}

// prepareProposalItems 以 Writer REST API 的資料建立 diff 基準，不能信任 Agent 自行重建的 snapshot。
func prepareProposalItems(ctx context.Context, source proposalSource, projectID string, items []agent.ProposalItem) ([]agent.ProposalItem, error) {
	for index := range items {
		item := &items[index]
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
			return nil, fmt.Errorf("提案項目 %d：無法讀取目前內容：%w", index+1, err)
		}
		if document.LatestVersionID == nil {
			return nil, fmt.Errorf("提案項目 %d：目前內容沒有可用的版本編號", index+1)
		}
		latest := fmt.Sprint(*document.LatestVersionID)
		if item.BaseVersionID == "" {
			item.BaseVersionID = latest
		}
		item.Base = &agent.ProposalSnapshot{Title: document.Title, Summary: document.Summary, ContentType: document.ContentType, Content: document.Content}
		if item.BaseVersionID != latest {
			version, err := source.VersionDetail(ctx, projectID, kind, item.TargetID, item.BaseVersionID)
			if err != nil {
				return nil, fmt.Errorf("提案項目 %d：無法讀取基準版本 #%s：%w", index+1, item.BaseVersionID, err)
			}
			item.Base = &agent.ProposalSnapshot{Title: version.Title, Summary: version.Summary, ContentType: document.ContentType, Content: version.Content}
		}
		for operationIndex := range item.Operations {
			arguments := item.Operations[operationIndex].Arguments
			if arguments == nil {
				return nil, fmt.Errorf("提案項目 %d：寫入操作缺少參數", index+1)
			}
			if target, ok := arguments[targetKey].(string); ok && target == item.TargetID {
				if base, exists := arguments["base_version_id"]; exists && fmt.Sprint(base) != item.BaseVersionID {
					return nil, fmt.Errorf("提案項目 %d：Agent 的 base_version_id 與提案基準不一致", index+1)
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
