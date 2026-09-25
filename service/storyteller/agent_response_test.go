package storyteller

import (
	"testing"

	"github.com/stretchr/testify/require"
)

func TestParseSuosuoResponse(t *testing.T) {
	tests := []struct {
		name       string
		input      string
		answer     string
		expression SuosuoExpression
	}{
		{
			name:       "valid response preserves markdown in cdata",
			input:      "<Response><Answer><![CDATA[## 建議\n\n保留 `A < B`。]]></Answer><Expression>thinking</Expression></Response>",
			answer:     "## 建議\n\n保留 `A < B`。",
			expression: SuosuoExpressionThinking,
		},
		{
			name:       "accepts accidental xml fence",
			input:      "```xml\n<Response><Answer><![CDATA[收好了。]]></Answer><Expression>pleased</Expression></Response>\n```",
			answer:     "收好了。",
			expression: SuosuoExpressionPleased,
		},
		{
			name:       "unknown expression falls back to neutral",
			input:      "<Response><Answer><![CDATA[先保留這一版。]]></Answer><Expression>happy</Expression></Response>",
			answer:     "先保留這一版。",
			expression: SuosuoExpressionNeutral,
		},
		{
			name:       "malformed response keeps provider text",
			input:      "原本的純文字回答",
			answer:     "原本的純文字回答",
			expression: SuosuoExpressionNeutral,
		},
		{
			name:       "recovers answer truncated by token limit",
			input:      "<Response><Answer><![CDATA[很長的改稿被截",
			answer:     "很長的改稿被截",
			expression: SuosuoExpressionNeutral,
		},
		{
			name:       "recovers malformed ampersand without exposing xml",
			input:      "<Response><Answer>A & B</Answer><Expression>thinking</Expression></Response>",
			answer:     "A & B",
			expression: SuosuoExpressionThinking,
		},
		{
			name:       "missing answer close does not expose following elements",
			input:      "<Response><Answer>還在回答<Expression>thinking</Expression></Response>",
			answer:     "還在回答",
			expression: SuosuoExpressionThinking,
		},
		{
			name:       "preserves unclosed html in malformed xml",
			input:      "<Response><Answer>第一行<br>第二行</Answer><Expression>neutral</Expression></Response>",
			answer:     "第一行<br>第二行",
			expression: SuosuoExpressionNeutral,
		},
		{
			name:       "preserves nested html in valid xml",
			input:      "<Response><Answer>有 <b>粗體</b> 的字</Answer><Expression>pleased</Expression></Response>",
			answer:     "有 <b>粗體</b> 的字",
			expression: SuosuoExpressionPleased,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			actual := parseSuosuoResponse(tt.input)
			require.Equal(t, tt.answer, actual.Answer)
			require.Equal(t, tt.expression, actual.Expression)
		})
	}
}
