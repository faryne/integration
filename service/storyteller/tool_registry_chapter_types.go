package storyteller

type storytellerStoryChapterArguments struct {
	ProjectPublicID string `json:"project_public_id"`
	StoryPublicID   string `json:"story_public_id"`
	MarkerID        string `json:"marker_id"`
}

type storytellerLoreChapterArguments struct {
	ProjectPublicID string `json:"project_public_id"`
	LorePublicID    string `json:"lore_public_id"`
	MarkerID        string `json:"marker_id"`
}

type storytellerReplaceStoryChapterArguments struct {
	ProjectPublicID string  `json:"project_public_id"`
	StoryPublicID   string  `json:"story_public_id"`
	MarkerID        string  `json:"marker_id"`
	Content         string  `json:"content"`
	BaseVersionID   *uint64 `json:"base_version_id"`
}

type storytellerReplaceLoreChapterArguments struct {
	ProjectPublicID string  `json:"project_public_id"`
	LorePublicID    string  `json:"lore_public_id"`
	MarkerID        string  `json:"marker_id"`
	Content         string  `json:"content"`
	BaseVersionID   *uint64 `json:"base_version_id"`
}

type storytellerInsertStoryChapterArguments struct {
	ProjectPublicID string  `json:"project_public_id"`
	StoryPublicID   string  `json:"story_public_id"`
	Content         string  `json:"content"`
	AfterMarkerID   string  `json:"after_marker_id"`
	BaseVersionID   *uint64 `json:"base_version_id"`
}

type storytellerInsertLoreChapterArguments struct {
	ProjectPublicID string  `json:"project_public_id"`
	LorePublicID    string  `json:"lore_public_id"`
	Content         string  `json:"content"`
	AfterMarkerID   string  `json:"after_marker_id"`
	BaseVersionID   *uint64 `json:"base_version_id"`
}

type storytellerDeleteStoryChapterArguments struct {
	ProjectPublicID string  `json:"project_public_id"`
	StoryPublicID   string  `json:"story_public_id"`
	MarkerID        string  `json:"marker_id"`
	BaseVersionID   *uint64 `json:"base_version_id"`
}

type storytellerDeleteLoreChapterArguments struct {
	ProjectPublicID string  `json:"project_public_id"`
	LorePublicID    string  `json:"lore_public_id"`
	MarkerID        string  `json:"marker_id"`
	BaseVersionID   *uint64 `json:"base_version_id"`
}

type storytellerChapterSummary struct {
	MarkerID     string `json:"marker_id"`
	HeadingLevel int    `json:"heading_level"`
	Title        string `json:"title"`
	WordCount    uint   `json:"word_count"`
	Order        int    `json:"order"`
}

type storytellerChapterDetail struct {
	storytellerChapterSummary
	Content   string `json:"content"`
	VersionID uint64 `json:"version_id"`
}

type storytellerChapterWriteOutput struct {
	storytellerChapterSummary
	VersionID       uint64 `json:"version_id"`
	VersionConflict bool   `json:"version_conflict,omitempty"`
}

type storytellerChapterDeleteOutput struct {
	DeletedMarkerID       string `json:"deleted_marker_id"`
	VersionID             uint64 `json:"version_id"`
	VersionConflict       bool   `json:"version_conflict,omitempty"`
	RemainingChapterCount int    `json:"remaining_chapter_count"`
}
