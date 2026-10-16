package main

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"strconv"

	"faryne.dev/apps/steamloom/writer/internal/agent"
	"faryne.dev/apps/steamloom/writer/internal/api"
)

// applyProposal 只採用 Writer 已 staging、hash 驗證並由使用者核准的 review 欄位；
// Operations 僅保留為 Agent 的意圖紀錄，不會被當成可執行指令。
func (a *App) applyProposal(ctx context.Context, proposal agent.Proposal, item agent.ProposalItem) (string, error) {
	switch item.ProposalType {
	case agent.ProposalTypeDocumentCreate:
		_, err := a.api.CreateProposedDocument(ctx, proposal.ProjectID, api.DocumentKind(item.Kind), api.ProposedDocumentInput{
			Title: item.Title, Summary: item.Summary, Content: item.Content, ContentType: item.ContentType, GroupPublicID: item.CollectionID,
		})
		return agent.ProposalItemApplyLabel(item), err
	case agent.ProposalTypeDocumentReplace, agent.ProposalTypeDocumentPatch, agent.ProposalTypeChapterAppend, agent.ProposalTypeChapterReplace:
		return agent.ProposalItemApplyLabel(item), a.applyTextProposal(ctx, proposal, item)
	case agent.ProposalTypeAssetUpload:
		return agent.ProposalItemApplyLabel(item), a.applyAssetProposal(ctx, proposal, item)
	case agent.ProposalTypeImageStoryCreate, agent.ProposalTypeImageStoryUpdate:
		return agent.ProposalItemApplyLabel(item), a.applyImageStoryProposal(ctx, proposal, item)
	default:
		return "", fmt.Errorf("不支援的提案類型：%s", item.ProposalType)
	}
}

func (a *App) applyTextProposal(ctx context.Context, proposal agent.Proposal, item agent.ProposalItem) error {
	kind := api.DocumentKind(item.Kind)
	content := item.Content
	if item.ProposalType == agent.ProposalTypeChapterAppend || item.ProposalType == agent.ProposalTypeChapterReplace {
		current, err := a.api.Document(ctx, proposal.ProjectID, kind, item.TargetID)
		if err != nil {
			return err
		}
		if current.LatestVersionID == nil || fmt.Sprint(*current.LatestVersionID) != item.BaseVersionID {
			return fmt.Errorf("%w：%s", agent.ErrApplyConflict, item.Title)
		}
		if item.ProposalType == agent.ProposalTypeChapterAppend {
			content, err = appendProposalChapter(current.Content, item.AfterMarkerID, item.Content)
		} else {
			content, err = replaceProposalChapter(current.Content, item.MarkerID, item.Content)
		}
		if err != nil {
			return err
		}
	}
	return a.saveProposalDocument(ctx, proposal.ProjectID, kind, item, content)
}

func (a *App) saveProposalDocument(ctx context.Context, projectID string, kind api.DocumentKind, item agent.ProposalItem, content string) error {
	baseVersionID, err := strconv.ParseUint(item.BaseVersionID, 10, 64)
	if err != nil {
		return fmt.Errorf("%s 的 base_version_id 不正確：%w", item.Title, err)
	}
	_, err = a.api.SaveDocument(ctx, projectID, kind, item.TargetID, api.SaveInput{
		Title: item.Title, Summary: item.Summary, Content: content, Trigger: "manual", BaseVersionID: &baseVersionID, AbortOnConflict: true,
	})
	if api.IsHTTPStatus(err, http.StatusConflict) {
		return fmt.Errorf("%w：%s", agent.ErrApplyConflict, item.Title)
	}
	return err
}

func (a *App) applyAssetProposal(ctx context.Context, proposal agent.Proposal, item agent.ProposalItem) error {
	if len(item.Artifacts) == 0 {
		path, err := agent.ProposalAssetPath(proposal.AgentID, proposal.ProjectID, proposal.ThreadID, proposal.ID, item.ID)
		if err != nil {
			return err
		}
		_, err = a.uploadProposalArtifact(ctx, proposal.ProjectID, item.CollectionID, path, item.Title, item.AltText, item.Summary)
		return err
	}
	for _, artifact := range item.Artifacts {
		if artifact.LocalPath == "" {
			continue
		}
		path, err := agent.ProposalArtifactPath(proposal.AgentID, proposal.ProjectID, proposal.ThreadID, proposal.ID, item.ID, artifact.ID)
		if err != nil {
			return err
		}
		if _, err := a.uploadProposalArtifact(ctx, proposal.ProjectID, item.CollectionID, path, artifact.FileName, artifact.AltText, artifact.Description); err != nil {
			return err
		}
	}
	return nil
}

func (a *App) uploadProposalArtifact(ctx context.Context, projectID, collectionID, path, title, altText, description string) (string, error) {
	uploaded, err := a.api.UploadAssets(ctx, projectID, collectionID, []string{path})
	if err != nil {
		return "", err
	}
	assetID := uploaded.Created[path]
	if assetID == "" {
		return "", fmt.Errorf("圖片 %s 未成功上傳", title)
	}
	_, err = a.api.UpdateAsset(ctx, projectID, assetID, api.AssetInput{Title: title, AltText: altText, Description: description})
	return assetID, err
}

func (a *App) applyImageStoryProposal(ctx context.Context, proposal agent.Proposal, item agent.ProposalItem) error {
	pages := make([]map[string]any, 0, len(item.Artifacts))
	for index, artifact := range item.Artifacts {
		assetID := artifact.AssetPublicID
		if artifact.LocalPath != "" {
			path, err := agent.ProposalArtifactPath(proposal.AgentID, proposal.ProjectID, proposal.ThreadID, proposal.ID, item.ID, artifact.ID)
			if err != nil {
				return err
			}
			assetID, err = a.uploadProposalArtifact(ctx, proposal.ProjectID, item.CollectionID, path, artifact.FileName, artifact.AltText, artifact.Description)
			if err != nil {
				return err
			}
		}
		if assetID == "" {
			return fmt.Errorf("圖像作品第 %d 頁沒有可用的資產", index+1)
		}
		pageID := artifact.PageID
		if pageID == "" {
			pageID = artifact.ID
		}
		pages = append(pages, map[string]any{"id": pageID, "asset_public_id": assetID, "description": artifact.Description, "sort": index})
	}
	raw, err := json.Marshal(map[string]any{"pages": pages})
	if err != nil {
		return err
	}
	if item.ProposalType == agent.ProposalTypeImageStoryCreate {
		_, err = a.api.CreateProposedDocument(ctx, proposal.ProjectID, api.KindStory, api.ProposedDocumentInput{
			Title: item.Title, Summary: item.Summary, Content: string(raw), ContentType: "image", GroupPublicID: item.CollectionID,
		})
		return err
	}
	return a.saveProposalDocument(ctx, proposal.ProjectID, api.KindStory, item, string(raw))
}
