package storyteller

import (
	"errors"
	"fmt"
	"strings"
)

func storytellerChapterSummaries(content string) []storytellerChapterSummary {
	lines := strings.Split(content, "\n")
	spans := storyChapterSpans(content)
	summaries := make([]storytellerChapterSummary, 0, len(spans))
	for order, span := range spans {
		summaries = append(summaries, storytellerChapterSummaryForSpan(lines, span, order))
	}
	return summaries
}

func storytellerChapterDetailByMarker(content, markerID string, versionID uint64) (storytellerChapterDetail, error) {
	lines := strings.Split(content, "\n")
	span, order, ok := findStoryChapterSpan(storyChapterSpans(content), markerID)
	if !ok {
		return storytellerChapterDetail{}, errStoryChapterNotFound(markerID)
	}
	return storytellerChapterDetail{
		storytellerChapterSummary: storytellerChapterSummaryForSpan(lines, span, order),
		Content:                   storyChapterContent(lines, span),
		VersionID:                 versionID,
	}, nil
}

func storytellerChapterSummaryForSpan(lines []string, span storyChapterSpan, order int) storytellerChapterSummary {
	return storytellerChapterSummary{
		MarkerID:     span.MarkerID,
		HeadingLevel: span.HeadingLevel,
		Title:        span.Title,
		WordCount:    wordCount(storyChapterContent(lines, span)),
		Order:        order,
	}
}

func findStoryChapterSpan(spans []storyChapterSpan, markerID string) (storyChapterSpan, int, bool) {
	markerID = strings.TrimSpace(markerID)
	if markerID == "" {
		return storyChapterSpan{}, 0, false
	}
	for i, span := range spans {
		if span.MarkerID == markerID {
			return span, i, true
		}
	}
	return storyChapterSpan{}, 0, false
}

func validateChapterContentStartsWithHeading(content string) error {
	spans := storyChapterSpans(content)
	if len(spans) == 0 {
		return errors.New("chapter content must include a heading line")
	}
	if spans[0].StartLine != 0 {
		return errors.New("chapter content must start with a heading line")
	}
	return nil
}

func storyChapterContent(lines []string, span storyChapterSpan) string {
	if span.StartLine < 0 || span.EndLine < span.StartLine || span.EndLine > len(lines) {
		return ""
	}
	return strings.Join(lines[span.StartLine:span.EndLine], "\n")
}

func replaceStoryChapterContent(content string, span storyChapterSpan, replacement string) (string, int) {
	lines := strings.Split(content, "\n")
	replacementLines := strings.Split(replacement, "\n")
	out := make([]string, 0, len(lines)-span.EndLine+span.StartLine+len(replacementLines))
	out = append(out, lines[:span.StartLine]...)
	out = append(out, replacementLines...)
	out = append(out, lines[span.EndLine:]...)
	return strings.Join(out, "\n"), span.StartLine
}

func insertStoryChapterContent(content, afterMarkerID, chapter string) (string, int, error) {
	if content == "" {
		return chapter, 0, nil
	}
	lines := strings.Split(content, "\n")
	insertAt := len(lines)
	if strings.TrimSpace(afterMarkerID) != "" {
		span, _, ok := findStoryChapterSpan(storyChapterSpans(content), afterMarkerID)
		if !ok {
			return "", 0, errStoryChapterNotFound(afterMarkerID)
		}
		insertAt = span.EndLine
	}
	if insertAt == len(lines) && len(lines) > 0 && lines[len(lines)-1] == "" {
		insertAt--
	}
	chapterLines := strings.Split(chapter, "\n")
	out := make([]string, 0, len(lines)+len(chapterLines))
	out = append(out, lines[:insertAt]...)
	out = append(out, chapterLines...)
	out = append(out, lines[insertAt:]...)
	return strings.Join(out, "\n"), insertAt, nil
}

func deleteStoryChapterContent(content, markerID string) (string, error) {
	lines := strings.Split(content, "\n")
	span, _, ok := findStoryChapterSpan(storyChapterSpans(content), markerID)
	if !ok {
		return "", errStoryChapterNotFound(markerID)
	}
	out := make([]string, 0, len(lines)-(span.EndLine-span.StartLine))
	out = append(out, lines[:span.StartLine]...)
	out = append(out, lines[span.EndLine:]...)
	return strings.Join(out, "\n"), nil
}

func storytellerChapterWriteOutputAfterSave(content string, startLine int, versionID uint64, conflicted bool) (storytellerChapterWriteOutput, error) {
	lines := strings.Split(content, "\n")
	for order, span := range storyChapterSpans(content) {
		if span.StartLine == startLine {
			return storytellerChapterWriteOutput{
				storytellerChapterSummary: storytellerChapterSummaryForSpan(lines, span, order),
				VersionID:                 versionID,
				VersionConflict:           conflicted,
			}, nil
		}
	}
	return storytellerChapterWriteOutput{}, fmt.Errorf("saved chapter heading could not be found at line %d", startLine)
}

func errStoryChapterNotFound(markerID string) error {
	if strings.TrimSpace(markerID) == "" {
		return errors.New("chapter marker_id is required")
	}
	return fmt.Errorf("chapter not found by marker_id: %s", markerID)
}
