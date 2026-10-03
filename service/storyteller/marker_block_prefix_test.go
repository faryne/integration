package storyteller

import "testing"

func TestHoistStoryMarkerBlockPrefixes(t *testing.T) {
	cases := []struct {
		name, source, in, want string
	}{
		{"heading", "mcp", "⟦a1⟧# 第一幕⟦/a1⟧", "# ⟦a1⟧第一幕⟦/a1⟧"},
		{"heading level 3 with align", "mcp", `⟦a1 align="center"⟧### 標題⟦/a1⟧`, `### ⟦a1 align="center"⟧標題⟦/a1⟧`},
		{"quote", "agentic_proposal", "⟦a1⟧> 引用⟦/a1⟧", "> ⟦a1⟧引用⟦/a1⟧"},
		{"ordered list", "mcp", "⟦a1⟧12. 項目⟦/a1⟧", "12. ⟦a1⟧項目⟦/a1⟧"},
		{"already canonical", "mcp", "# ⟦a1⟧第一幕⟦/a1⟧", "# ⟦a1⟧第一幕⟦/a1⟧"},
		{"plain paragraph", "mcp", "⟦a1⟧*斜體*⟦/a1⟧", "⟦a1⟧*斜體*⟦/a1⟧"},
		{"seven hashes is not heading", "mcp", "⟦a1⟧####### x⟦/a1⟧", "⟦a1⟧####### x⟦/a1⟧"},
		{"hr stays literal", "mcp", "⟦a1⟧---⟦/a1⟧", "⟦a1⟧---⟦/a1⟧"},
		// 網頁編輯器存出的 marker 內前綴是使用者打的字面文字，不能動
		{"web source untouched", "web_auto", "⟦a1⟧- 字面⟦/a1⟧", "⟦a1⟧- 字面⟦/a1⟧"},
		{"multi line", "mcp", "⟦a1⟧# 一⟦/a1⟧\n⟦a2⟧⟦/a2⟧\n⟦a3⟧內文⟦/a3⟧", "# ⟦a1⟧一⟦/a1⟧\n⟦a2⟧⟦/a2⟧\n⟦a3⟧內文⟦/a3⟧"},
	}
	for _, c := range cases {
		if got := hoistStoryMarkerBlockPrefixes(c.in, c.source); got != c.want {
			t.Errorf("%s: got %q, want %q", c.name, got, c.want)
		}
	}
}
