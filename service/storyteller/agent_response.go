package storyteller

import (
	"encoding/xml"
	"html"
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
	XMLName xml.Name `xml:"Response"`
	Answer  struct {
		InnerXML string `xml:",innerxml"`
	} `xml:"Answer"`
	Expression string `xml:"Expression"`
}

// parseSuosuoResponse 先解析完整 envelope；若 provider 因 token 上限截斷 XML，
// 則僅回收 Answer 內已生成的文字，不把結構標籤暴露給使用者。
func parseSuosuoResponse(raw string) suosuoResponse {
	trimmed := strings.TrimSpace(raw)
	candidate := trimXMLCodeFence(trimmed)
	var envelope suosuoResponseXML
	if err := xml.Unmarshal([]byte(candidate), &envelope); err == nil && envelope.XMLName.Local == "Response" {
		if answer := cleanSuosuoAnswer(envelope.Answer.InnerXML); answer != "" {
			return suosuoResponse{
				Answer:     answer,
				Expression: normalizeSuosuoExpression(envelope.Expression),
			}
		}
	}

	answer, ok := extractSuosuoElement(candidate, "Answer")
	answer = cleanSuosuoAnswer(answer)
	if !ok || answer == "" {
		return suosuoResponse{Answer: trimmed, Expression: SuosuoExpressionNeutral}
	}
	expression, _ := extractSuosuoElement(candidate, "Expression")
	return suosuoResponse{
		Answer:     answer,
		Expression: normalizeSuosuoExpression(expression),
	}
}

func cleanSuosuoAnswer(value string) string {
	trimmed := strings.TrimSpace(value)
	if strings.HasPrefix(trimmed, "<![CDATA[") {
		trimmed = strings.TrimPrefix(trimmed, "<![CDATA[")
		trimmed = strings.TrimSuffix(trimmed, "]]>")
		return strings.TrimSpace(trimmed)
	}
	return strings.TrimSpace(html.UnescapeString(trimmed))
}

// extractSuosuoElement 用實際元素邊界回收內容；缺少結尾標籤時取到文本尾端，
// 讓 max_tokens 截斷的 Answer 仍能顯示。
func extractSuosuoElement(value, name string) (string, bool) {
	openTag := "<" + name + ">"
	start := strings.Index(value, openTag)
	if start < 0 {
		return "", false
	}
	start += len(openTag)
	closeTag := "</" + name + ">"
	if end := strings.LastIndex(value[start:], closeTag); end >= 0 {
		return value[start : start+end], true
	}
	tail := value[start:]
	// Answer 少了結尾標籤、但 provider 仍輸出後續元素時，不把後續 XML 當成回答。
	if name == "Answer" {
		for _, boundary := range []string{"<Expression>", "</Response>"} {
			if end := strings.Index(tail, boundary); end >= 0 {
				tail = tail[:end]
			}
		}
	}
	return tail, true
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
