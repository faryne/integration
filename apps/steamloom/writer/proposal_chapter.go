package main

import (
	"errors"
	"regexp"
	"strings"
)

var proposalMarkerPattern = regexp.MustCompile(`^⟦([^⟧\s]*)(?: align="(?:left|center|right)")?(?: comment="(?:[^"\\]|\\.)*")?(?: commentColor="(?:yellow|pink|blue|green|purple)")?⟧([\s\S]*)⟦/([^⟧\s]*)⟧$`)

type proposalChapterSpan struct {
	MarkerID           string
	StartLine, EndLine int
}

// proposalChapterSpans 只辨識一般 Markdown heading；code fence 與表格 marker 內的 # 不算章節。
func proposalChapterSpans(content string) []proposalChapterSpan {
	lines := strings.Split(content, "\n")
	spans := []proposalChapterSpan{}
	inCode := false
	for index, line := range lines {
		if strings.HasPrefix(line, "```") {
			inCode = !inCode
			continue
		}
		if inCode || strings.HasPrefix(line, "⟦table") {
			continue
		}
		level := 0
		for level < len(line) && level < 6 && line[level] == '#' {
			level++
		}
		if level == 0 || level >= len(line) || line[level] != ' ' {
			continue
		}
		markerID := ""
		if match := proposalMarkerPattern.FindStringSubmatch(line[level+1:]); match != nil && match[1] == match[3] {
			markerID = match[1]
		}
		if len(spans) > 0 {
			spans[len(spans)-1].EndLine = index
		}
		spans = append(spans, proposalChapterSpan{MarkerID: markerID, StartLine: index, EndLine: len(lines)})
	}
	return spans
}

func proposalChapterContent(content, markerID string) (string, error) {
	lines := strings.Split(content, "\n")
	for _, span := range proposalChapterSpans(content) {
		if markerID != "" && span.MarkerID == markerID {
			return strings.Join(lines[span.StartLine:span.EndLine], "\n"), nil
		}
	}
	return "", errors.New("找不到指定的章節 marker")
}

func replaceProposalChapter(content, markerID, replacement string) (string, error) {
	lines := strings.Split(content, "\n")
	for _, span := range proposalChapterSpans(content) {
		if span.MarkerID != markerID {
			continue
		}
		result := append([]string{}, lines[:span.StartLine]...)
		result = append(result, strings.Split(replacement, "\n")...)
		result = append(result, lines[span.EndLine:]...)
		return strings.Join(result, "\n"), nil
	}
	return "", errors.New("找不到指定的章節 marker")
}

func appendProposalChapter(content, afterMarkerID, chapter string) (string, error) {
	if content == "" {
		return chapter, nil
	}
	lines := strings.Split(content, "\n")
	insertAt := len(lines)
	if afterMarkerID != "" {
		found := false
		for _, span := range proposalChapterSpans(content) {
			if span.MarkerID == afterMarkerID {
				insertAt, found = span.EndLine, true
				break
			}
		}
		if !found {
			return "", errors.New("找不到指定的插入位置 marker")
		}
	}
	if insertAt == len(lines) && len(lines) > 0 && lines[len(lines)-1] == "" {
		insertAt--
	}
	result := append([]string{}, lines[:insertAt]...)
	result = append(result, strings.Split(chapter, "\n")...)
	result = append(result, lines[insertAt:]...)
	return strings.Join(result, "\n"), nil
}
