package agent

import (
	"strings"
	"testing"
)

func TestParseProposalEnvelopeSeparatesVisibleReply(t *testing.T) {
	answer := `草稿完成，尚未寫入 SteamLoom。
<<<STEAMLOOM_WRITER_PROPOSAL_V1>>>
{"items":[{"kind":"story","operations":[{"tool":"storyteller_upsert_story","arguments":{"project_public_id":"project","story_public_id":"story-1"}}],"target_id":"story-1","base_version_id":42,"title":"第一話","content_type":"text","content":"新內容","base":{"title":"第一話","content_type":"text","content":"舊內容"}}]}
<<<END_STEAMLOOM_WRITER_PROPOSAL_V1>>>`
	visible, items, err := parseProposalEnvelope(answer)
	if err != nil {
		t.Fatal(err)
	}
	if visible != "草稿完成，尚未寫入 SteamLoom。" || len(items) != 1 {
		t.Fatalf("unexpected parsed proposal: %q %#v", visible, items)
	}
	if items[0].BaseVersionID != "42" || items[0].Operations[0].Tool != "storyteller_upsert_story" {
		t.Fatalf("proposal fields were lost: %#v", items[0])
	}
}

func TestParseProposalEnvelopeV2KeepsExplicitTypeAndArtifacts(t *testing.T) {
	answer := `已整理成兩頁圖像作品，尚未寫入 SteamLoom。
<<<STEAMLOOM_WRITER_PROPOSAL_V2>>>
{"items":[{"proposal_type":"image_story.create","kind":"story","title":"雨夜","content_type":"image","artifacts":[{"local_path":"/tmp/one.png","file_name":"one.png","mime_type":"image/png","alt_text":"雨中的月台","page_id":"page-one","model":"grok-imagine","parameters":{"aspect_ratio":"16:9"}},{"asset_public_id":"asset-two","description":"第二頁","default_selected":false}]}]}
<<<END_STEAMLOOM_WRITER_PROPOSAL_V2>>>`
	visible, items, err := parseProposalEnvelope(answer)
	if err != nil {
		t.Fatal(err)
	}
	if visible != "已整理成兩頁圖像作品，尚未寫入 SteamLoom。" || len(items) != 1 {
		t.Fatalf("unexpected parsed proposal: %q %#v", visible, items)
	}
	item := items[0]
	if item.ProposalType != ProposalTypeImageStoryCreate || len(item.Artifacts) != 2 || item.Artifacts[0].PageID != "page-one" || item.Artifacts[0].Model != "grok-imagine" || !item.Artifacts[0].DefaultSelected || item.Artifacts[1].AssetPublicID != "asset-two" || item.Artifacts[1].DefaultSelected {
		t.Fatalf("v2 fields were lost: %#v", item)
	}
}

func TestParseMediaBriefProposal(t *testing.T) {
	answer := "已整理成生成需求，尚未呼叫 Worker。\n" + proposalEnvelopeStart + "\n" +
		`{"items":[{"proposal_type":"media.brief","kind":"media","worker_id":"mock-1","title":"角色設定圖","brief":{"prompt":"blue-haired heroine","negative_prompt":"watermark","candidate_count":2}}]}` +
		"\n" + proposalEnvelopeEnd
	_, items, err := parseProposalEnvelope(answer)
	if err != nil {
		t.Fatal(err)
	}
	if len(items) != 1 || items[0].WorkerID != "mock-1" || items[0].Brief == nil || items[0].Brief.Prompt != "blue-haired heroine" {
		t.Fatalf("media brief fields were lost: %#v", items)
	}
	if err := normalizeProposalItem(&items[0], "project"); err != nil || items[0].Kind != ProposalKindMedia {
		t.Fatalf("media brief was not normalized: %#v, %v", items[0], err)
	}
}

func TestParseProposalEnvelopeRejectsUnknownOrTrailingContent(t *testing.T) {
	for _, answer := range []string{
		proposalEnvelopeStart + `{"items":[],"status":"approved"}` + proposalEnvelopeEnd,
		"摘要" + proposalEnvelopeStart + `{"items":[{}]}` + proposalEnvelopeEnd + "不能放在後面",
		proposalEnvelopeStart + `{"items":[]}`,
		"摘要" + proposalEnvelopeStart + `{"items":[]}` + proposalEnvelopeEnd,
	} {
		if _, _, err := parseProposalEnvelope(answer); err == nil {
			t.Fatalf("invalid proposal was accepted: %s", answer)
		}
	}
}

func TestProposalDeltaFilterHidesEnvelopeAcrossChunks(t *testing.T) {
	filter := proposalDeltaFilter{}
	chunks := []string{"正常回", "覆\n<<<STEAMLOOM_", "WRITER_PROPOSAL_V1>>>", `{"items":[]}`, proposalEnvelopeEnd}
	var visible strings.Builder
	for _, chunk := range chunks {
		visible.WriteString(filter.Push(chunk))
	}
	visible.WriteString(filter.Flush())
	if visible.String() != "正常回覆\n" {
		t.Fatalf("proposal leaked into stream: %q", visible.String())
	}

	plain := proposalDeltaFilter{}
	if got := plain.Push("沒有 proposal 的一般回答") + plain.Flush(); got != "沒有 proposal 的一般回答" {
		t.Fatalf("plain stream was changed: %q", got)
	}
}

func TestPatchProposalKeepsEditsAndRequiresThem(t *testing.T) {
	answer := "改好了，尚未寫入。\n" + proposalEnvelopeStart + "\n" +
		`{"items":[{"proposal_type":"document.patch","kind":"story","target_id":"story-1","base_version_id":42,"edits":[{"find":"梭梭","replace":"那頭","all":true}]}]}` +
		"\n" + proposalEnvelopeEnd
	_, items, err := parseProposalEnvelope(answer)
	if err != nil || len(items[0].Edits) != 1 || !items[0].Edits[0].All {
		t.Fatalf("edits were lost: %#v, %v", items, err)
	}
	patch := ProposalItem{ProposalType: ProposalTypeDocumentPatch, Kind: ProposalKindStory, TargetID: "story-1", BaseVersionID: "42", Base: &ProposalSnapshot{}}
	if err := normalizeProposalItem(&patch, "project"); err == nil || !strings.Contains(err.Error(), "至少要有一筆 edits") {
		t.Fatalf("patch without edits must fail: %v", err)
	}
	create := ProposalItem{ProposalType: ProposalTypeDocumentCreate, Kind: ProposalKindStory, Edits: []ProposalEdit{{Find: "a"}}}
	if err := normalizeProposalItem(&create, "project"); err == nil || !strings.Contains(err.Error(), "只有 document.patch") {
		t.Fatalf("edits on other proposal types must fail: %v", err)
	}
}

func TestProposalHashIgnoresEmptyEditsForExistingProposals(t *testing.T) {
	// 既有待確認提案沒有 edits 欄位；加入 Edits 後 hash 必須與舊格式相同，否則會被誤判為遭到修改。
	item := ProposalItem{ProposalType: ProposalTypeDocumentReplace, Kind: ProposalKindStory, TargetID: "story-1", Content: "內容"}
	legacy, err := hashJSON(struct {
		ProposalType, Kind, TargetID, BaseVersionID, Title, Summary, ContentType, Content, MarkerID, AfterMarkerID string
		Base                                                                                                       *ProposalSnapshot
		Operations                                                                                                 []ProposalOperation
		FileName, MIMEType, FileSHA256, AltText, CollectionID                                                      string
		Artifacts                                                                                                  []ProposalArtifact
	}{item.ProposalType, item.Kind, item.TargetID, "", "", "", "", item.Content, "", "", nil, nil, "", "", "", "", "", nil})
	if err != nil {
		t.Fatal(err)
	}
	proposal := Proposal{Items: []ProposalItem{item}}
	if err := setProposalHashes(&proposal); err != nil {
		t.Fatal(err)
	}
	if proposal.Items[0].ContentHash != legacy {
		t.Fatalf("hash changed for proposals without edits: %s != %s", proposal.Items[0].ContentHash, legacy)
	}
}
