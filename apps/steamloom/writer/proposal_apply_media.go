package main

import (
	"context"
	"errors"
	"fmt"
	"os"
	"path/filepath"
	"sort"
	"strings"
	"sync"
	"time"

	"faryne.dev/apps/steamloom/writer/internal/agent"
	"faryne.dev/apps/steamloom/writer/internal/mediaworker"
)

type mediaRunOutcome struct {
	run    int
	result mediaworker.GenerateResult
	err    error
}

func (a *App) applyMediaBrief(ctx context.Context, proposal agent.Proposal, item agent.ProposalItem) error {
	spec, err := a.workers.JobSpec(item.WorkerID)
	if err != nil {
		return err
	}
	policy, err := a.workers.ExecutionPolicy(item.WorkerID)
	if err != nil {
		return err
	}
	executionCount := max(item.ExecutionCount, 1)
	root, err := os.MkdirTemp("", "steamloom-worker-batch-*")
	if err != nil {
		return err
	}
	defer os.RemoveAll(root)

	outcomes := a.executeMediaRuns(ctx, item, root, executionCount, policy)
	if err := ctx.Err(); err != nil {
		return err
	}
	artifacts, requests, completedRuns, failures := collectMediaRuns(item.WorkerID, executionCount, outcomes)
	if len(artifacts) == 0 {
		if len(failures) > 0 {
			return errors.New(strings.Join(failures, "；"))
		}
		return errors.New("Worker 沒有回傳任何媒體成果")
	}
	warning := ""
	if len(failures) > 0 {
		warning = strings.Join(failures, "；") + "，已保留其他完成的成果"
	}
	_, err = agent.SaveGeneratedProposal(proposal.AgentID, proposal.ProjectID, proposal.ThreadID, proposal.TaskID, root, spec.WorkerName, requests, completedRuns, executionCount, warning, []agent.ProposalItem{{
		ProposalType: agent.ProposalTypeAssetUpload, Kind: agent.ProposalKindAsset, Title: item.Title, Summary: item.Summary, CollectionID: item.CollectionID, Artifacts: artifacts,
	}})
	return err
}

// executeMediaRuns 每隔 adapter 指定的時間派送一個 job，並用 semaphore 限制同時執行數。
func (a *App) executeMediaRuns(ctx context.Context, item agent.ProposalItem, root string, executionCount int, policy mediaworker.ExecutionPolicy) []mediaRunOutcome {
	return executeStaggeredMediaRuns(ctx, executionCount, policy, func(run int) mediaRunOutcome {
		if err := agent.ReportApplyItemProgress(ctx, agent.EventApplyItemStarted, fmt.Sprintf("第 %d/%d 開始", run, executionCount)); err != nil {
			return mediaRunOutcome{run: run, err: err}
		}
		result, err := a.workers.Execute(ctx, item.WorkerID, item.JobInputs)
		if err == nil {
			err = relocateWorkerResult(&result, filepath.Join(root, fmt.Sprintf("run-%02d", run)))
		}
		if err != nil {
			_ = os.RemoveAll(result.Root)
			if progressErr := agent.ReportApplyItemProgress(ctx, agent.EventApplyItemFailed, fmt.Sprintf("第 %d/%d 失敗：%v", run, executionCount, err)); progressErr != nil {
				err = fmt.Errorf("%v；保存失敗進度時發生：%w", err, progressErr)
			}
			return mediaRunOutcome{run: run, result: result, err: err}
		}
		err = agent.ReportApplyItemProgress(ctx, agent.EventApplyItemDone, fmt.Sprintf("第 %d/%d 完成", run, executionCount))
		return mediaRunOutcome{run: run, result: result, err: err}
	})
}

func executeStaggeredMediaRuns(ctx context.Context, executionCount int, policy mediaworker.ExecutionPolicy, execute func(int) mediaRunOutcome) []mediaRunOutcome {
	results := make(chan mediaRunOutcome, executionCount)
	semaphore := make(chan struct{}, max(policy.MaxConcurrency, 1))
	var wg sync.WaitGroup

schedule:
	for run := 1; run <= executionCount; run++ {
		if run > 1 && policy.LaunchInterval > 0 {
			timer := time.NewTimer(policy.LaunchInterval)
			select {
			case <-timer.C:
			case <-ctx.Done():
				timer.Stop()
				break schedule
			}
		}
		select {
		case semaphore <- struct{}{}:
		case <-ctx.Done():
			break schedule
		}
		wg.Add(1)
		go func(run int) {
			defer wg.Done()
			defer func() { <-semaphore }()
			results <- execute(run)
		}(run)
	}
	wg.Wait()
	close(results)
	outcomes := make([]mediaRunOutcome, 0, executionCount)
	for outcome := range results {
		outcomes = append(outcomes, outcome)
	}
	sort.Slice(outcomes, func(i, j int) bool { return outcomes[i].run < outcomes[j].run })
	return outcomes
}

func collectMediaRuns(workerID string, executionCount int, outcomes []mediaRunOutcome) ([]agent.ProposalArtifact, []*mediaworker.RequestAudit, int, []string) {
	artifacts := []agent.ProposalArtifact{}
	requests := []*mediaworker.RequestAudit{}
	completedRuns := 0
	failures := []string{}
	for _, outcome := range outcomes {
		if outcome.result.Request != nil {
			requests = append(requests, outcome.result.Request)
		}
		if outcome.err != nil {
			failures = append(failures, fmt.Sprintf("第 %d/%d 失敗：%v", outcome.run, executionCount, outcome.err))
			continue
		}
		completedRuns++
		for _, artifact := range outcome.result.Artifacts {
			artifacts = append(artifacts, agent.ProposalArtifact{
				ProviderID: workerID, ProviderJobID: artifact.ProviderJobID, Model: artifact.Model, Parameters: artifact.Parameters,
				CandidateGroup: artifact.CandidateGroup, DefaultSelected: true, LocalPath: artifact.LocalPath, FileName: artifact.FileName,
				MIMEType: artifact.MIMEType, AltText: artifact.AltText, Description: artifact.Description, Width: artifact.Width, Height: artifact.Height,
			})
		}
	}
	return artifacts, requests, completedRuns, failures
}

// relocateWorkerResult 把每次執行的暫存目錄收進同一個 batch root，讓提案 staging 仍能做單一路徑邊界檢查。
func relocateWorkerResult(result *mediaworker.GenerateResult, destination string) error {
	relative := make([]string, len(result.Artifacts))
	for index, artifact := range result.Artifacts {
		path, err := filepath.Rel(result.Root, artifact.LocalPath)
		if err != nil || path == ".." || strings.HasPrefix(path, ".."+string(filepath.Separator)) {
			return errors.New("Worker 回傳了輸出目錄外的檔案")
		}
		relative[index] = path
	}
	if err := os.Rename(result.Root, destination); err != nil {
		return fmt.Errorf("整理 Worker 執行結果失敗：%w", err)
	}
	for index := range result.Artifacts {
		result.Artifacts[index].LocalPath = filepath.Join(destination, relative[index])
	}
	return nil
}
