package agent

import (
	"crypto/sha256"
	"encoding/base64"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"os"
	"path/filepath"
	"sort"
	"strings"
)

const maxProposalAssetSize = 100 << 20

var proposalAssetExtensions = map[string]string{
	"image/jpeg": ".jpg",
	"image/png":  ".png",
	"image/webp": ".webp",
	"image/gif":  ".gif",
}

// SaveProposal 將 Agent 回傳的成果搬進 Writer 管理的本機目錄，再追加 proposal.ready event。
func SaveProposal(agentID, projectID, threadID, taskID, assetRoot string, items []ProposalItem) (Proposal, error) {
	return saveProposal(agentID, projectID, threadID, taskID, assetRoot, Reply{}, items)
}

// saveTaskProposal 在提案驗證成功後才把摘要、completed 與 proposal.ready 一起落盤。
func saveTaskProposal(agentID, projectID, threadID, taskID, assetRoot string, reply Reply, items []ProposalItem) (Proposal, error) {
	return saveProposal(agentID, projectID, threadID, taskID, assetRoot, reply, items)
}

func saveProposal(agentID, projectID, threadID, taskID, assetRoot string, reply Reply, items []ProposalItem) (Proposal, error) {
	chatMu.Lock()
	defer chatMu.Unlock()
	dir, idx, err := loadChat(agentID, projectID)
	if err != nil {
		return Proposal{}, err
	}
	thread, ok := threadByID(idx, threadID)
	if !ok {
		return Proposal{}, errors.New("找不到這段對話")
	}
	proposal, err := prepareProposal(agentID, projectID, threadID, taskID, items)
	if err != nil {
		return Proposal{}, err
	}
	root := filepath.Join(dir, "proposals", threadID)
	finalDir := filepath.Join(root, proposal.ID)
	stagingDir := finalDir + ".tmp"
	if err := os.MkdirAll(stagingDir, 0o700); err != nil {
		return Proposal{}, err
	}
	defer os.RemoveAll(stagingDir)
	for index := range proposal.Items {
		if proposal.Items[index].Kind != ProposalKindAsset {
			continue
		}
		if err := stageProposalAsset(&proposal.Items[index], assetRoot, stagingDir, finalDir); err != nil {
			return Proposal{}, fmt.Errorf("提案項目 %d：%w", index+1, err)
		}
	}
	if err := setProposalHashes(&proposal); err != nil {
		return Proposal{}, err
	}
	raw, err := json.MarshalIndent(proposal, "", "  ")
	if err != nil {
		return Proposal{}, err
	}
	if err := os.WriteFile(filepath.Join(stagingDir, "proposal.json"), append(raw, '\n'), 0o600); err != nil {
		return Proposal{}, err
	}
	if err := os.Rename(stagingDir, finalDir); err != nil {
		return Proposal{}, err
	}
	event := taskEvent(EventProposalReady, taskID, fmt.Sprintf("Agent 已提出 %d 項成果，等待確認", len(proposal.Items)))
	event.ProposalID = proposal.ID
	events := make([]ChatLine, 0, 3)
	if reply.Text != "" {
		events = append(events, messageEvent("assistant", reply.Text), taskEvent(EventTaskCompleted, taskID, "Agent 已完成工作"))
	}
	events = append(events, event)
	if err := appendLines(filepath.Join(dir, thread.ID+".jsonl"), events); err != nil {
		_ = os.RemoveAll(finalDir)
		return Proposal{}, err
	}
	if reply.SessionID != "" {
		thread.SessionID = reply.SessionID
	}
	thread.UpdatedAt = now()
	thread.LastTaskState = TaskAwaitingConfirmation
	thread.ActiveTaskID = ""
	idx.Threads = upsertFront(idx.Threads, thread)
	if err := saveIndex(dir, idx); err != nil {
		return Proposal{}, err
	}
	return proposal, nil
}

func stageProposalAsset(item *ProposalItem, assetRoot, stagingDir, finalDir string) error {
	extension, ok := proposalAssetExtensions[item.MIMEType]
	if !ok {
		return errors.New("只接受 JPEG、PNG、WebP 或 GIF 圖片")
	}
	if !filepath.IsAbs(item.LocalPath) {
		return errors.New("圖片資產必須使用絕對路徑")
	}
	if assetRoot == "" || !pathInside(item.LocalPath, assetRoot) {
		return errors.New("圖片資產必須位於這條 Agent session 的工作目錄")
	}
	source, err := os.Open(item.LocalPath)
	if err != nil {
		return err
	}
	defer source.Close()
	info, err := source.Stat()
	if err != nil {
		return err
	}
	if !info.Mode().IsRegular() {
		return errors.New("圖片資產不是一般檔案")
	}
	artifactDir := filepath.Join(stagingDir, "artifacts")
	if err := os.MkdirAll(artifactDir, 0o700); err != nil {
		return err
	}
	name := item.ID + extension
	destination, err := os.OpenFile(filepath.Join(artifactDir, name), os.O_CREATE|os.O_EXCL|os.O_WRONLY, 0o600)
	if err != nil {
		return err
	}
	hash := sha256.New()
	written, copyErr := io.Copy(io.MultiWriter(destination, hash), io.LimitReader(source, maxProposalAssetSize+1))
	closeErr := destination.Close()
	if copyErr != nil {
		return copyErr
	}
	if closeErr != nil {
		return closeErr
	}
	if written > maxProposalAssetSize {
		return errors.New("圖片資產超過 100 MiB")
	}
	item.FileSize = written
	item.FileSHA256 = hex.EncodeToString(hash.Sum(nil))
	item.LocalPath = filepath.Join(finalDir, "artifacts", name)
	if item.FileName == "" {
		item.FileName = filepath.Base(info.Name())
	}
	return nil
}

func pathInside(path, root string) bool {
	resolvedPath, err := filepath.EvalSymlinks(path)
	if err != nil {
		return false
	}
	resolvedRoot, err := filepath.EvalSymlinks(root)
	if err != nil {
		return false
	}
	relative, err := filepath.Rel(resolvedRoot, resolvedPath)
	return err == nil && relative != ".." && !filepath.IsAbs(relative) && !strings.HasPrefix(relative, ".."+string(filepath.Separator))
}

// Proposals 讀取一條 thread 的全部 proposal；payload 留在本機，不會查詢 SteamLoom。
func Proposals(agentID, projectID, threadID string) ([]Proposal, error) {
	chatMu.Lock()
	defer chatMu.Unlock()
	dir, idx, err := loadChat(agentID, projectID)
	if err != nil {
		return nil, err
	}
	if !validThread(threadID) || !hasThread(idx, threadID) {
		return nil, errors.New("找不到這段對話")
	}
	entries, err := os.ReadDir(filepath.Join(dir, "proposals", threadID))
	if errors.Is(err, os.ErrNotExist) {
		return []Proposal{}, nil
	}
	if err != nil {
		return nil, err
	}
	decisions, err := proposalDecisions(filepath.Join(dir, threadID+".jsonl"))
	if err != nil {
		return nil, err
	}
	proposals := make([]Proposal, 0, len(entries))
	for _, entry := range entries {
		if !entry.IsDir() || !validThread(entry.Name()) {
			continue
		}
		proposal, err := readProposal(filepath.Join(dir, "proposals", threadID, entry.Name(), "proposal.json"))
		if err != nil {
			return nil, err
		}
		if decision, exists := decisions[proposal.ID]; exists {
			proposal.Status, proposal.DecidedAt = decision.status, decision.at
		}
		if lifecycle, exists := proposalApplyLifecycle(filepath.Join(dir, threadID+".jsonl"), proposal.ID); exists {
			proposal.Status = lifecycle.status
			if lifecycle.status == ProposalVerificationRequired {
				proposal.InterruptedAt = lifecycle.at
			} else if lifecycle.at != "" {
				proposal.AppliedAt = lifecycle.at
			}
		}
		proposals = append(proposals, proposal)
	}
	sort.SliceStable(proposals, func(i, j int) bool { return proposals[i].CreatedAt < proposals[j].CreatedAt })
	return proposals, nil
}

// ProposalByID 讀取 Writer 本機 proposal，供確認前做 DB latest 檢查；不接觸 MCP。
func ProposalByID(agentID, projectID, threadID, proposalID string) (Proposal, error) {
	if !validThread(proposalID) {
		return Proposal{}, errors.New("找不到這批提案")
	}
	proposals, err := Proposals(agentID, projectID, threadID)
	if err != nil {
		return Proposal{}, err
	}
	for _, proposal := range proposals {
		if proposal.ID == proposalID {
			return proposal, nil
		}
	}
	return Proposal{}, errors.New("找不到這批提案")
}

type proposalDecision struct {
	status string
	at     string
	taskID string
}

func proposalDecisions(path string) (map[string]proposalDecision, error) {
	events, err := readLines(path)
	if err != nil {
		return nil, err
	}
	decisions := map[string]proposalDecision{}
	for _, event := range events {
		status := ""
		switch event.Type {
		case EventProposalApproved:
			status = ProposalApproved
		case EventProposalRejected:
			status = ProposalRejected
		}
		if status != "" && event.ProposalID != "" {
			decisions[event.ProposalID] = proposalDecision{status: status, at: event.CreatedAt}
		}
	}
	return decisions, nil
}

func proposalApplyLifecycle(path, proposalID string) (proposalDecision, bool) {
	events, err := readLines(path)
	if err != nil {
		return proposalDecision{}, false
	}
	state := proposalDecision{}
	found := false
	for _, event := range events {
		if event.ProposalID != proposalID {
			continue
		}
		switch event.Type {
		case EventApplyStarted:
			state, found = proposalDecision{status: ProposalApplying, taskID: event.TaskID}, true
		case EventApplyCompleted:
			state, found = proposalDecision{status: ProposalApplied, at: event.CreatedAt, taskID: event.TaskID}, true
		case EventApplyFailed:
			state, found = proposalDecision{status: ProposalApplyFailed, at: event.CreatedAt, taskID: event.TaskID}, true
		case EventApplyConflict:
			state, found = proposalDecision{status: ProposalConflict, at: event.CreatedAt, taskID: event.TaskID}, true
		case EventApplyInterrupted:
			state, found = proposalDecision{status: ProposalVerificationRequired, at: event.CreatedAt, taskID: event.TaskID}, true
		}
	}
	return state, found
}

// DecideProposal 以 append-only event 作為決策事實來源；重複送出相同決策不會新增第二筆事件。
func DecideProposal(agentID, projectID, threadID, proposalID, decision string) (Proposal, error) {
	status, eventType, text := ProposalApproved, EventProposalApproved, "你已允許 Agent 寫入，等待 Agent 執行"
	if decision == ProposalDecisionReject {
		status, eventType, text = ProposalRejected, EventProposalRejected, "你已否決這批變更；Agent 不會寫入"
	} else if decision != ProposalDecisionApprove {
		return Proposal{}, errors.New("不支援的提案決策")
	}
	chatMu.Lock()
	defer chatMu.Unlock()
	if !validThread(threadID) || !validThread(proposalID) {
		return Proposal{}, errors.New("找不到這批提案")
	}
	dir, idx, err := loadChat(agentID, projectID)
	if err != nil {
		return Proposal{}, err
	}
	thread, ok := threadByID(idx, threadID)
	if !ok {
		return Proposal{}, errors.New("找不到這段對話")
	}
	path := filepath.Join(dir, "proposals", threadID, proposalID, "proposal.json")
	proposal, err := readProposal(path)
	if err != nil {
		return Proposal{}, err
	}
	if proposal.AgentID != agentID || proposal.ProjectID != projectID || proposal.ThreadID != threadID {
		return Proposal{}, errors.New("提案不屬於目前對話")
	}
	if err := verifyProposalHashes(proposal); err != nil {
		return Proposal{}, err
	}
	proposalDir := filepath.Dir(path)
	for _, item := range proposal.Items {
		if item.Kind == ProposalKindAsset {
			if _, err := readVerifiedProposalAsset(item, proposalDir); err != nil {
				return Proposal{}, err
			}
		}
	}
	logPath := filepath.Join(dir, threadID+".jsonl")
	decisions, err := proposalDecisions(logPath)
	if err != nil {
		return Proposal{}, err
	}
	if previous, exists := decisions[proposalID]; exists {
		proposal.Status, proposal.DecidedAt = previous.status, previous.at
		if previous.status == status {
			if lifecycle, found := proposalApplyLifecycle(logPath, proposal.ID); found {
				proposal.Status, proposal.AppliedAt = lifecycle.status, lifecycle.at
			}
			return proposal, nil
		}
		return Proposal{}, errors.New("這批提案已經完成其他決策")
	}
	if proposal.Status != ProposalAwaitingConfirmation {
		return Proposal{}, errors.New("這批提案已經不在等待確認狀態")
	}
	event := taskEvent(eventType, proposal.TaskID, text)
	event.ProposalID, event.ContentHash = proposal.ID, proposal.ContentHash
	if err := appendLines(logPath, []ChatLine{event}); err != nil {
		return Proposal{}, err
	}
	proposal.Status, proposal.DecidedAt = status, event.CreatedAt
	if err := writeProposal(path, proposal); err != nil {
		return Proposal{}, err
	}
	thread.UpdatedAt, thread.LastTaskState, thread.ActiveTaskID = now(), status, ""
	idx.Threads = upsertFront(idx.Threads, thread)
	if err := saveIndex(dir, idx); err != nil {
		return Proposal{}, err
	}
	return proposal, nil
}

func writeProposal(path string, proposal Proposal) error {
	raw, err := json.MarshalIndent(proposal, "", "  ")
	if err != nil {
		return err
	}
	temporary := path + ".tmp"
	if err := os.WriteFile(temporary, append(raw, '\n'), 0o600); err != nil {
		return err
	}
	if err := os.Rename(temporary, path); err != nil {
		_ = os.Remove(temporary)
		return err
	}
	return nil
}

func readProposal(path string) (Proposal, error) {
	raw, err := os.ReadFile(path)
	if err != nil {
		return Proposal{}, err
	}
	var proposal Proposal
	if err := json.Unmarshal(raw, &proposal); err != nil {
		return Proposal{}, err
	}
	return proposal, nil
}

// ProposalAssetPreview 驗證檔案仍與提案 hash 相同後，才回傳給 webview 預覽。
func ProposalAssetPreview(agentID, projectID, threadID, proposalID, itemID string) (string, error) {
	chatMu.Lock()
	defer chatMu.Unlock()
	if !validThread(threadID) || !validThread(proposalID) || !validThread(itemID) {
		return "", errors.New("找不到這份圖片提案")
	}
	dir, idx, err := loadChat(agentID, projectID)
	if err != nil {
		return "", err
	}
	if !hasThread(idx, threadID) {
		return "", errors.New("找不到這段對話")
	}
	proposalDir := filepath.Join(dir, "proposals", threadID, proposalID)
	proposal, err := readProposal(filepath.Join(proposalDir, "proposal.json"))
	if err != nil {
		return "", err
	}
	for _, item := range proposal.Items {
		if item.ID != itemID || item.Kind != ProposalKindAsset {
			continue
		}
		raw, err := readVerifiedProposalAsset(item, proposalDir)
		if err != nil {
			return "", err
		}
		return "data:" + item.MIMEType + ";base64," + base64.StdEncoding.EncodeToString(raw), nil
	}
	return "", errors.New("找不到這份圖片提案")
}

func readVerifiedProposalAsset(item ProposalItem, proposalDir string) ([]byte, error) {
	if !pathInside(item.LocalPath, proposalDir) {
		return nil, errors.New("圖片提案的本機路徑不正確")
	}
	raw, err := os.ReadFile(item.LocalPath)
	if err != nil {
		return nil, err
	}
	if int64(len(raw)) != item.FileSize {
		return nil, errors.New("圖片提案已在確認前被修改")
	}
	sum := sha256.Sum256(raw)
	if hex.EncodeToString(sum[:]) != item.FileSHA256 {
		return nil, errors.New("圖片提案已在確認前被修改")
	}
	if _, ok := proposalAssetExtensions[item.MIMEType]; !ok {
		return nil, errors.New("圖片提案的 MIME type 不正確")
	}
	return raw, nil
}
