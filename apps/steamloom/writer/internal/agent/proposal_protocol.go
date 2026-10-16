package agent

import (
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"strings"
)

const (
	proposalEnvelopeStart       = "<<<STEAMLOOM_WRITER_PROPOSAL_V2>>>"
	proposalEnvelopeEnd         = "<<<END_STEAMLOOM_WRITER_PROPOSAL_V2>>>"
	legacyProposalEnvelopeStart = "<<<STEAMLOOM_WRITER_PROPOSAL_V1>>>"
	legacyProposalEnvelopeEnd   = "<<<END_STEAMLOOM_WRITER_PROPOSAL_V1>>>"
	maxProposalEnvelope         = 16 << 20
)

type proposalSubmission struct {
	Items []proposalSubmissionItem `json:"items"`
}

// submission type 刻意不含 id／status／hash，信任邊界內的欄位只能由 Writer 產生。
type proposalSubmissionItem struct {
	ProposalType  string                       `json:"proposal_type,omitempty"`
	Kind          string                       `json:"kind"`
	Operations    []ProposalOperation          `json:"operations"`
	TargetID      string                       `json:"target_id,omitempty"`
	BaseVersionID proposalStringID             `json:"base_version_id,omitempty"`
	Title         string                       `json:"title,omitempty"`
	Summary       string                       `json:"summary,omitempty"`
	ContentType   string                       `json:"content_type,omitempty"`
	Content       string                       `json:"content,omitempty"`
	Base          *ProposalSnapshot            `json:"base,omitempty"`
	LocalPath     string                       `json:"local_path,omitempty"`
	FileName      string                       `json:"file_name,omitempty"`
	MIMEType      string                       `json:"mime_type,omitempty"`
	AltText       string                       `json:"alt_text,omitempty"`
	CollectionID  string                       `json:"collection_id,omitempty"`
	MarkerID      string                       `json:"marker_id,omitempty"`
	AfterMarkerID string                       `json:"after_marker_id,omitempty"`
	Artifacts     []proposalSubmissionArtifact `json:"artifacts,omitempty"`
	Edits         []ProposalEdit               `json:"edits,omitempty"`
}

// proposalSubmissionArtifact 排除 Writer 產生的 id、檔案大小與 hash，避免 Agent 越過 staging 信任邊界。
type proposalSubmissionArtifact struct {
	ProviderJobID   string         `json:"provider_job_id,omitempty"`
	Model           string         `json:"model,omitempty"`
	Parameters      map[string]any `json:"parameters,omitempty"`
	CandidateGroup  string         `json:"candidate_group,omitempty"`
	DefaultSelected *bool          `json:"default_selected,omitempty"`
	LocalPath       string         `json:"local_path,omitempty"`
	AssetPublicID   string         `json:"asset_public_id,omitempty"`
	FileName        string         `json:"file_name,omitempty"`
	MIMEType        string         `json:"mime_type,omitempty"`
	AltText         string         `json:"alt_text,omitempty"`
	Description     string         `json:"description,omitempty"`
	Width           int            `json:"width,omitempty"`
	Height          int            `json:"height,omitempty"`
	DurationMS      int64          `json:"duration_ms,omitempty"`
	PageID          string         `json:"page_id,omitempty"`
}

// MCP 的 version id 是數字，但部分 Agent 會為了避免精度問題輸出字串；兩種都正規化成字串保存。
type proposalStringID string

func (id *proposalStringID) UnmarshalJSON(raw []byte) error {
	var value any
	decoder := json.NewDecoder(strings.NewReader(string(raw)))
	decoder.UseNumber()
	if err := decoder.Decode(&value); err != nil {
		return err
	}
	switch typed := value.(type) {
	case string:
		*id = proposalStringID(typed)
	case json.Number:
		if _, err := typed.Int64(); err != nil {
			return errors.New("base_version_id 必須是整數或字串")
		}
		*id = proposalStringID(typed.String())
	default:
		return errors.New("base_version_id 必須是整數或字串")
	}
	return nil
}

func parseProposalEnvelope(answer string) (string, []ProposalItem, error) {
	startMarker, endMarker := proposalEnvelopeStart, proposalEnvelopeEnd
	start := strings.LastIndex(answer, startMarker)
	if legacy := strings.LastIndex(answer, legacyProposalEnvelopeStart); legacy > start {
		start, startMarker, endMarker = legacy, legacyProposalEnvelopeStart, legacyProposalEnvelopeEnd
	}
	if start < 0 {
		return answer, nil, nil
	}
	endOffset := strings.Index(answer[start+len(startMarker):], endMarker)
	if endOffset < 0 {
		return "", nil, errors.New("Agent 回傳的 proposal 缺少結束標記")
	}
	end := start + len(startMarker) + endOffset
	if strings.TrimSpace(answer[end+len(endMarker):]) != "" {
		return "", nil, errors.New("proposal 結束後不能再附加內容")
	}
	payload := strings.TrimSpace(answer[start+len(startMarker) : end])
	if len(payload) > maxProposalEnvelope {
		return "", nil, errors.New("Agent 回傳的 proposal 超過 16 MiB")
	}
	decoder := json.NewDecoder(strings.NewReader(payload))
	decoder.DisallowUnknownFields()
	var submission proposalSubmission
	if err := decoder.Decode(&submission); err != nil {
		return "", nil, fmt.Errorf("Agent 回傳的 proposal JSON 不正確：%w", err)
	}
	if err := ensureJSONEOF(decoder); err != nil {
		return "", nil, err
	}
	visible := strings.TrimSpace(answer[:start])
	if visible == "" {
		return "", nil, errors.New("Agent 回傳 proposal 時必須附上對作者可讀的摘要")
	}
	if len(submission.Items) == 0 {
		return "", nil, errors.New("Agent 回傳的 proposal 沒有成果項目")
	}
	items := make([]ProposalItem, len(submission.Items))
	for index, item := range submission.Items {
		artifacts := make([]ProposalArtifact, len(item.Artifacts))
		for artifactIndex, artifact := range item.Artifacts {
			defaultSelected := true
			if artifact.DefaultSelected != nil {
				defaultSelected = *artifact.DefaultSelected
			}
			artifacts[artifactIndex] = ProposalArtifact{
				ProviderJobID: artifact.ProviderJobID, Model: artifact.Model, Parameters: artifact.Parameters,
				CandidateGroup: artifact.CandidateGroup, DefaultSelected: defaultSelected,
				LocalPath: artifact.LocalPath, AssetPublicID: artifact.AssetPublicID, FileName: artifact.FileName,
				MIMEType: artifact.MIMEType, AltText: artifact.AltText, Description: artifact.Description,
				Width: artifact.Width, Height: artifact.Height, DurationMS: artifact.DurationMS, PageID: artifact.PageID,
			}
		}
		items[index] = ProposalItem{
			ProposalType: item.ProposalType, Kind: item.Kind, Operations: item.Operations, TargetID: item.TargetID, BaseVersionID: string(item.BaseVersionID),
			Title: item.Title, Summary: item.Summary, ContentType: item.ContentType, Content: item.Content, Base: item.Base,
			LocalPath: item.LocalPath, FileName: item.FileName, MIMEType: item.MIMEType, AltText: item.AltText, CollectionID: item.CollectionID,
			MarkerID: item.MarkerID, AfterMarkerID: item.AfterMarkerID, Artifacts: artifacts, Edits: item.Edits,
		}
	}
	return visible, items, nil
}

func ensureJSONEOF(decoder *json.Decoder) error {
	var extra any
	if err := decoder.Decode(&extra); err == io.EOF {
		return nil
	} else if err != nil {
		return fmt.Errorf("Agent 回傳的 proposal JSON 不正確：%w", err)
	}
	return errors.New("Agent 回傳的 proposal JSON 包含多餘內容")
}

// proposalDeltaFilter 只讓 marker 前的自然語言進入 streaming UI；完整 JSON 留給結束時解析。
type proposalDeltaFilter struct {
	tail       string
	suppressed bool
}

func (f *proposalDeltaFilter) Push(text string) string {
	if f.suppressed {
		return ""
	}
	combined := f.tail + text
	index := firstEnvelopeIndex(combined)
	if index >= 0 {
		f.tail, f.suppressed = "", true
		return combined[:index]
	}
	keep := len(proposalEnvelopeStart) - 1
	if len(combined) <= keep {
		f.tail = combined
		return ""
	}
	visible := combined[:len(combined)-keep]
	f.tail = combined[len(combined)-keep:]
	return visible
}

func firstEnvelopeIndex(text string) int {
	current, legacy := strings.Index(text, proposalEnvelopeStart), strings.Index(text, legacyProposalEnvelopeStart)
	if current < 0 {
		return legacy
	}
	if legacy >= 0 && legacy < current {
		return legacy
	}
	return current
}

func (f *proposalDeltaFilter) Flush() string {
	if f.suppressed {
		return ""
	}
	text := f.tail
	f.tail = ""
	return text
}
