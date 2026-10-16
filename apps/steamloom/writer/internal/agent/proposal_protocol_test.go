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
