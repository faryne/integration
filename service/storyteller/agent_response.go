package storyteller

import (
	"encoding/xml"
	"strings"
)

// SuosuoExpression 是 AI 助理回覆可選的梭梭表情；名稱直接對應 CDN avatar 檔名。
type SuosuoExpression string

const (
	SuosuoExpressionNeutral   SuosuoExpression = "neutral"
	SuosuoExpressionAttentive SuosuoExpression = "attentive"
	SuosuoExpressionThinking  SuosuoExpression = "thinking"
	SuosuoExpressionPleased   SuosuoExpression = "pleased"
	SuosuoExpressionConcerned SuosuoExpression = "concerned"
	SuosuoExpressionTangled   SuosuoExpression = "tangled"
)

type suosuoResponse struct {
	Answer     string
	Expression SuosuoExpression
}

type suosuoResponseXML struct {
	XMLName    xml.Name `xml:"Response"`
	Answer     string   `xml:"Answer"`
	Expression string   `xml:"Expression"`
}

// parseSuosuoResponse 只在 provider 給出最終文字後解析 envelope。格式不合法時保留
// provider 原文並回退 neutral，避免模型偶爾漏標籤就讓使用者整則回答消失。
func parseSuosuoResponse(raw string) suosuoResponse {
	trimmed := strings.TrimSpace(raw)
	candidate := trimXMLCodeFence(trimmed)
	var envelope suosuoResponseXML
	if err := xml.Unmarshal([]byte(candidate), &envelope); err != nil || envelope.XMLName.Local != "Response" || strings.TrimSpace(envelope.Answer) == "" {
		return suosuoResponse{Answer: trimmed, Expression: SuosuoExpressionNeutral}
	}
	return suosuoResponse{
		Answer:     strings.TrimSpace(envelope.Answer),
		Expression: normalizeSuosuoExpression(envelope.Expression),
	}
}

func normalizeSuosuoExpression(value string) SuosuoExpression {
	switch expression := SuosuoExpression(strings.ToLower(strings.TrimSpace(value))); expression {
	case SuosuoExpressionNeutral, SuosuoExpressionAttentive, SuosuoExpressionThinking,
		SuosuoExpressionPleased, SuosuoExpressionConcerned, SuosuoExpressionTangled:
		return expression
	default:
		return SuosuoExpressionNeutral
	}
}

func trimXMLCodeFence(value string) string {
	if !strings.HasPrefix(value, "```") || !strings.HasSuffix(value, "```") {
		return value
	}
	firstNewline := strings.IndexByte(value, '\n')
	if firstNewline < 0 {
		return value
	}
	return strings.TrimSpace(value[firstNewline+1 : len(value)-3])
}
