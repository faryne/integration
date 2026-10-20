package agent

import "testing"

func TestNormalizeEventHydratesLegacyOperationMetadata(t *testing.T) {
	tests := []struct {
		line                  ChatLine
		proposalType, title   string
		current, total, count int
	}{
		{ChatLine{Type: EventProposalApproved, Text: "已核准執行：媒體生成〈林曉薇〉，執行 2 次"}, ProposalTypeMediaBrief, "林曉薇", 0, 0, 2},
		{ChatLine{Type: EventProposalApproved, Text: "已核准上傳資產：圖片〈林曉薇〉，共 4 項"}, ProposalTypeAssetUpload, "林曉薇", 0, 0, 4},
		{ChatLine{Type: EventApplyItemStarted, Text: "上傳圖片「林曉薇」……第 1/4 開始"}, ProposalTypeAssetUpload, "林曉薇", 1, 4, 0},
		{ChatLine{Type: EventApplyCompleted, Text: "Writer 已依你的核准套用 1 項提案。"}, "", "", 0, 0, 1},
	}
	for _, test := range tests {
		got, ok := normalizeEvent(test.line)
		if !ok || got.OperationType != test.proposalType || got.OperationTitle != test.title || got.Current != test.current || got.Total != test.total || got.Count != test.count {
			t.Fatalf("normalizeEvent(%q) = %#v, ok=%v", test.line.Text, got, ok)
		}
	}
	line, ok := normalizeEvent(ChatLine{Type: EventProposalApproved, Text: "已核准套用 2 項：故事〈第一話〉、設定〈角色 A〉"})
	if !ok || len(line.Operations) != 2 || line.Operations[0].Kind != ProposalKindStory || line.Operations[1].Title != "角色 A" {
		t.Fatalf("legacy multi-item decision = %#v, ok=%v", line, ok)
	}
}
