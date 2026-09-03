package storyteller

import (
	"errors"
	"strings"
	"unicode/utf8"

	storytellerModel "faryne.dev/model/entity/storyteller"
	"faryne.dev/repository"
)

const writingBookmarkMarkerIDMaxRunes = 64

var (
	ErrWritingBookmarkDuplicate = errors.New("這個段落已經有書籤了")
	ErrWritingBookmarkNotFound  = errors.New("找不到這筆書籤")
)

func normalizeWritingBookmarkMarkerID(raw string) (string, error) {
	markerID := strings.TrimSpace(raw)
	if markerID == "" {
		return "", errors.New("marker_id is required")
	}
	if utf8.RuneCountInString(markerID) > writingBookmarkMarkerIDMaxRunes {
		return "", errors.New("marker_id is too long")
	}
	return markerID, nil
}

func normalizeWritingBookmarkNote(raw string) *string {
	note := strings.TrimSpace(raw)
	if note == "" {
		return nil
	}
	return &note
}

func (s *Service) StoryWritingBookmarks(userID uint64, projectPublicID, storyPublicID string) ([]storytellerModel.WritingBookmark, error) {
	project, err := s.repo.ProjectByPublicIDForUser(userID, projectPublicID)
	if err != nil {
		return nil, err
	}
	story, err := s.repo.Story(project.ID, strings.TrimSpace(storyPublicID))
	if err != nil {
		return nil, err
	}
	return s.repo.WritingBookmarksByStory(userID, story.ID)
}

func (s *Service) LoreWritingBookmarks(userID uint64, projectPublicID, lorePublicID string) ([]storytellerModel.WritingBookmark, error) {
	project, err := s.repo.ProjectByPublicIDForUser(userID, projectPublicID)
	if err != nil {
		return nil, err
	}
	lore, err := s.repo.Lore(project.ID, strings.TrimSpace(lorePublicID))
	if err != nil {
		return nil, err
	}
	return s.repo.WritingBookmarksByLore(userID, lore.ID)
}

func (s *Service) CreateStoryWritingBookmark(userID uint64, projectPublicID, storyPublicID string, input storytellerModel.WritingBookmarkRequest) (*storytellerModel.WritingBookmark, error) {
	markerID, err := normalizeWritingBookmarkMarkerID(input.MarkerID)
	if err != nil {
		return nil, err
	}
	project, err := s.repo.ProjectByPublicIDForUser(userID, projectPublicID)
	if err != nil {
		return nil, err
	}
	story, err := s.repo.Story(project.ID, strings.TrimSpace(storyPublicID))
	if err != nil {
		return nil, err
	}
	if _, err := s.repo.WritingBookmarkByStoryMarker(userID, story.ID, markerID); err == nil {
		return nil, ErrWritingBookmarkDuplicate
	} else if !repository.IsRecordNotFound(err) {
		return nil, err
	}
	storyID := story.ID
	row := &storytellerModel.WritingBookmark{
		StoryID:  &storyID,
		UserID:   userID,
		MarkerID: markerID,
		Note:     normalizeWritingBookmarkNote(input.Note),
	}
	if err := s.repo.CreateWritingBookmark(row); err != nil {
		return nil, err
	}
	return row, nil
}

func (s *Service) CreateLoreWritingBookmark(userID uint64, projectPublicID, lorePublicID string, input storytellerModel.WritingBookmarkRequest) (*storytellerModel.WritingBookmark, error) {
	markerID, err := normalizeWritingBookmarkMarkerID(input.MarkerID)
	if err != nil {
		return nil, err
	}
	project, err := s.repo.ProjectByPublicIDForUser(userID, projectPublicID)
	if err != nil {
		return nil, err
	}
	lore, err := s.repo.Lore(project.ID, strings.TrimSpace(lorePublicID))
	if err != nil {
		return nil, err
	}
	if _, err := s.repo.WritingBookmarkByLoreMarker(userID, lore.ID, markerID); err == nil {
		return nil, ErrWritingBookmarkDuplicate
	} else if !repository.IsRecordNotFound(err) {
		return nil, err
	}
	loreID := lore.ID
	row := &storytellerModel.WritingBookmark{
		LoreID:   &loreID,
		UserID:   userID,
		MarkerID: markerID,
		Note:     normalizeWritingBookmarkNote(input.Note),
	}
	if err := s.repo.CreateWritingBookmark(row); err != nil {
		return nil, err
	}
	return row, nil
}

func (s *Service) UpdateStoryWritingBookmark(userID uint64, projectPublicID, storyPublicID string, input storytellerModel.WritingBookmarkRequest) (*storytellerModel.WritingBookmark, error) {
	markerID, err := normalizeWritingBookmarkMarkerID(input.MarkerID)
	if err != nil {
		return nil, err
	}
	project, err := s.repo.ProjectByPublicIDForUser(userID, projectPublicID)
	if err != nil {
		return nil, err
	}
	story, err := s.repo.Story(project.ID, strings.TrimSpace(storyPublicID))
	if err != nil {
		return nil, err
	}
	row, err := s.repo.WritingBookmarkByStoryMarker(userID, story.ID, markerID)
	if err != nil {
		if repository.IsRecordNotFound(err) {
			return nil, ErrWritingBookmarkNotFound
		}
		return nil, err
	}
	note := normalizeWritingBookmarkNote(input.Note)
	if err := s.repo.UpdateWritingBookmarkNote(row.ID, note); err != nil {
		return nil, err
	}
	row.Note = note
	return row, nil
}

func (s *Service) UpdateLoreWritingBookmark(userID uint64, projectPublicID, lorePublicID string, input storytellerModel.WritingBookmarkRequest) (*storytellerModel.WritingBookmark, error) {
	markerID, err := normalizeWritingBookmarkMarkerID(input.MarkerID)
	if err != nil {
		return nil, err
	}
	project, err := s.repo.ProjectByPublicIDForUser(userID, projectPublicID)
	if err != nil {
		return nil, err
	}
	lore, err := s.repo.Lore(project.ID, strings.TrimSpace(lorePublicID))
	if err != nil {
		return nil, err
	}
	row, err := s.repo.WritingBookmarkByLoreMarker(userID, lore.ID, markerID)
	if err != nil {
		if repository.IsRecordNotFound(err) {
			return nil, ErrWritingBookmarkNotFound
		}
		return nil, err
	}
	note := normalizeWritingBookmarkNote(input.Note)
	if err := s.repo.UpdateWritingBookmarkNote(row.ID, note); err != nil {
		return nil, err
	}
	row.Note = note
	return row, nil
}

func (s *Service) DeleteStoryWritingBookmark(userID uint64, projectPublicID, storyPublicID, markerID string) error {
	normalized, err := normalizeWritingBookmarkMarkerID(markerID)
	if err != nil {
		return err
	}
	project, err := s.repo.ProjectByPublicIDForUser(userID, projectPublicID)
	if err != nil {
		return err
	}
	story, err := s.repo.Story(project.ID, strings.TrimSpace(storyPublicID))
	if err != nil {
		return err
	}
	if _, err := s.repo.WritingBookmarkByStoryMarker(userID, story.ID, normalized); err != nil {
		if repository.IsRecordNotFound(err) {
			return ErrWritingBookmarkNotFound
		}
		return err
	}
	return s.repo.DeleteWritingBookmarkByStoryMarker(userID, story.ID, normalized)
}

func (s *Service) DeleteLoreWritingBookmark(userID uint64, projectPublicID, lorePublicID, markerID string) error {
	normalized, err := normalizeWritingBookmarkMarkerID(markerID)
	if err != nil {
		return err
	}
	project, err := s.repo.ProjectByPublicIDForUser(userID, projectPublicID)
	if err != nil {
		return err
	}
	lore, err := s.repo.Lore(project.ID, strings.TrimSpace(lorePublicID))
	if err != nil {
		return err
	}
	if _, err := s.repo.WritingBookmarkByLoreMarker(userID, lore.ID, normalized); err != nil {
		if repository.IsRecordNotFound(err) {
			return ErrWritingBookmarkNotFound
		}
		return err
	}
	return s.repo.DeleteWritingBookmarkByLoreMarker(userID, lore.ID, normalized)
}
