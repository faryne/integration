package agent

import (
	"crypto/sha256"
	"encoding/base64"
	"encoding/hex"
	"errors"
	"os"
	"path/filepath"
)

// ProposalAssetPreview 驗證檔案仍與提案 hash 相同後，才回傳給 webview 預覽。
func ProposalAssetPreview(agentID, projectID, threadID, proposalID, itemID string) (string, error) {
	_, mimeType, raw, err := verifiedProposalAsset(agentID, projectID, threadID, proposalID, itemID)
	if err != nil {
		return "", err
	}
	return "data:" + mimeType + ";base64," + base64.StdEncoding.EncodeToString(raw), nil
}

// ProposalAssetPath 在 Writer 真正上傳前再次驗證 staged artifact，避免核准後檔案遭置換。
func ProposalAssetPath(agentID, projectID, threadID, proposalID, itemID string) (string, error) {
	path, _, _, err := verifiedProposalAsset(agentID, projectID, threadID, proposalID, itemID)
	return path, err
}

// ProposalArtifactPreview 預覽圖像作品或批次資產提案中的單一 staged artifact。
func ProposalArtifactPreview(agentID, projectID, threadID, proposalID, itemID, artifactID string) (string, error) {
	path, mimeType, raw, err := verifiedProposalArtifact(agentID, projectID, threadID, proposalID, itemID, artifactID)
	_ = path
	if err != nil {
		return "", err
	}
	return "data:" + mimeType + ";base64," + base64.StdEncoding.EncodeToString(raw), nil
}

// ProposalArtifactPath 在上傳前再次驗證 artifact 的大小與 SHA-256。
func ProposalArtifactPath(agentID, projectID, threadID, proposalID, itemID, artifactID string) (string, error) {
	path, _, _, err := verifiedProposalArtifact(agentID, projectID, threadID, proposalID, itemID, artifactID)
	return path, err
}

func verifiedProposalAsset(agentID, projectID, threadID, proposalID, itemID string) (string, string, []byte, error) {
	chatMu.Lock()
	defer chatMu.Unlock()
	if !validThread(threadID) || !validThread(proposalID) || !validThread(itemID) {
		return "", "", nil, errors.New("找不到這份圖片提案")
	}
	dir, idx, err := loadChat(agentID, projectID)
	if err != nil {
		return "", "", nil, err
	}
	if !hasThread(idx, threadID) {
		return "", "", nil, errors.New("找不到這段對話")
	}
	proposalDir := filepath.Join(dir, "proposals", threadID, proposalID)
	proposal, err := readProposal(filepath.Join(proposalDir, "proposal.json"))
	if err != nil {
		return "", "", nil, err
	}
	for _, item := range proposal.Items {
		if item.ID != itemID || item.Kind != ProposalKindAsset {
			continue
		}
		raw, err := readVerifiedProposalAsset(item, proposalDir)
		if err != nil {
			return "", "", nil, err
		}
		return item.LocalPath, item.MIMEType, raw, nil
	}
	return "", "", nil, errors.New("找不到這份圖片提案")
}

func readVerifiedProposalAsset(item ProposalItem, proposalDir string) ([]byte, error) {
	return readVerifiedProposalArtifact(ProposalArtifact{LocalPath: item.LocalPath, MIMEType: item.MIMEType, FileSize: item.FileSize, FileSHA256: item.FileSHA256}, proposalDir)
}

func verifiedProposalArtifact(agentID, projectID, threadID, proposalID, itemID, artifactID string) (string, string, []byte, error) {
	chatMu.Lock()
	defer chatMu.Unlock()
	if !validThread(threadID) || !validThread(proposalID) || !validThread(itemID) || !validThread(artifactID) {
		return "", "", nil, errors.New("找不到這份圖片成果")
	}
	dir, idx, err := loadChat(agentID, projectID)
	if err != nil {
		return "", "", nil, err
	}
	if !hasThread(idx, threadID) {
		return "", "", nil, errors.New("找不到這段對話")
	}
	proposalDir := filepath.Join(dir, "proposals", threadID, proposalID)
	proposal, err := readProposal(filepath.Join(proposalDir, "proposal.json"))
	if err != nil {
		return "", "", nil, err
	}
	for _, item := range proposal.Items {
		if item.ID != itemID {
			continue
		}
		for _, artifact := range item.Artifacts {
			if artifact.ID != artifactID || artifact.LocalPath == "" {
				continue
			}
			raw, err := readVerifiedProposalArtifact(artifact, proposalDir)
			if err != nil {
				return "", "", nil, err
			}
			return artifact.LocalPath, artifact.MIMEType, raw, nil
		}
	}
	return "", "", nil, errors.New("找不到這份圖片成果")
}

func readVerifiedProposalArtifact(artifact ProposalArtifact, proposalDir string) ([]byte, error) {
	if !pathInside(artifact.LocalPath, proposalDir) {
		return nil, errors.New("圖片提案的本機路徑不正確")
	}
	raw, err := os.ReadFile(artifact.LocalPath)
	if err != nil {
		return nil, err
	}
	if int64(len(raw)) != artifact.FileSize {
		return nil, errors.New("圖片提案已在確認前被修改")
	}
	sum := sha256.Sum256(raw)
	if hex.EncodeToString(sum[:]) != artifact.FileSHA256 {
		return nil, errors.New("圖片提案已在確認前被修改")
	}
	if _, ok := proposalAssetExtensions[artifact.MIMEType]; !ok {
		return nil, errors.New("圖片提案的 MIME type 不正確")
	}
	return raw, nil
}
