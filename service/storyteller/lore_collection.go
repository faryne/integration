package storyteller

import (
	"errors"
	"strings"

	storytellerModel "faryne.dev/model/entity/storyteller"
)

const loreCollectionUncategorized = "__uncategorized__"

func (s *Service) resolveLoreCollectionID(projectID uint64, collectionPublicID string) (*uint64, error) {
	collectionPublicID = strings.TrimSpace(collectionPublicID)
	if collectionPublicID == "" || collectionPublicID == loreCollectionUncategorized {
		return nil, nil
	}
	collection, err := s.repo.LoreCollection(projectID, collectionPublicID)
	if err != nil {
		return nil, err
	}
	return &collection.ID, nil
}

func (s *Service) resolveLoreCollectionFilter(projectID uint64, collectionPublicID string) (*uint64, bool, error) {
	collectionPublicID = strings.TrimSpace(collectionPublicID)
	if collectionPublicID == loreCollectionUncategorized {
		return nil, true, nil
	}
	collectionID, err := s.resolveLoreCollectionID(projectID, collectionPublicID)
	return collectionID, false, err
}

func (s *Service) loreCollectionPublicIDMap(projectID uint64) (map[uint64]string, error) {
	collections, err := s.repo.LoreCollections(projectID)
	if err != nil {
		return nil, err
	}
	output := make(map[uint64]string, len(collections))
	for _, collection := range collections {
		output[collection.ID] = collection.PublicID
	}
	return output, nil
}

func (s *Service) fillLoreCollectionPublicIDs(projectID uint64, rows []storytellerModel.Lore) error {
	collectionPublicIDs, err := s.loreCollectionPublicIDMap(projectID)
	if err != nil {
		return err
	}
	for i := range rows {
		if rows[i].CollectionID != nil {
			rows[i].CollectionPublicID = collectionPublicIDs[*rows[i].CollectionID]
		}
	}
	return nil
}

func (s *Service) fillLoreCollectionPublicID(projectID uint64, row *storytellerModel.Lore) error {
	if row.CollectionID == nil {
		row.CollectionPublicID = ""
		return nil
	}
	collectionPublicIDs, err := s.loreCollectionPublicIDMap(projectID)
	if err != nil {
		return err
	}
	row.CollectionPublicID = collectionPublicIDs[*row.CollectionID]
	return nil
}

func (s *Service) LoreCollections(userID uint64, projectPublicID string) ([]storytellerModel.LoreCollectionOutput, error) {
	project, err := s.repo.ProjectByPublicIDForUser(userID, projectPublicID)
	if err != nil {
		return nil, err
	}
	rows, err := s.repo.LoreCollections(project.ID)
	if err != nil {
		return nil, err
	}
	ids := make([]uint64, 0, len(rows))
	for _, row := range rows {
		ids = append(ids, row.ID)
	}
	counts, err := s.repo.LoreCollectionLoreCounts(ids)
	if err != nil {
		return nil, err
	}
	outputs := make([]storytellerModel.LoreCollectionOutput, 0, len(rows))
	for _, row := range rows {
		outputs = append(outputs, loreCollectionOutput(row, counts[row.ID]))
	}
	return outputs, nil
}

func (s *Service) CreateLoreCollection(userID uint64, projectPublicID string, input storytellerModel.LoreCollectionRequest) (*storytellerModel.LoreCollectionOutput, error) {
	project, err := s.repo.ProjectByPublicIDForUser(userID, projectPublicID)
	if err != nil {
		return nil, err
	}
	name := strings.TrimSpace(input.Name)
	if name == "" {
		return nil, errors.New("collection name is required")
	}
	description := strings.TrimSpace(input.Description)
	row := &storytellerModel.LoreCollection{
		PublicID:    randomID(),
		ProjectID:   project.ID,
		Name:        name,
		Description: &description,
		Sort:        input.Sort,
	}
	if err := s.repo.CreateLoreCollection(row); err != nil {
		return nil, err
	}
	output := loreCollectionOutput(*row, 0)
	return &output, nil
}

func (s *Service) UpdateLoreCollection(userID uint64, projectPublicID, collectionPublicID string, input storytellerModel.LoreCollectionRequest) (*storytellerModel.LoreCollectionOutput, error) {
	project, err := s.repo.ProjectByPublicIDForUser(userID, projectPublicID)
	if err != nil {
		return nil, err
	}
	row, err := s.repo.LoreCollection(project.ID, strings.TrimSpace(collectionPublicID))
	if err != nil {
		return nil, err
	}
	name := strings.TrimSpace(input.Name)
	if name == "" {
		return nil, errors.New("collection name is required")
	}
	description := strings.TrimSpace(input.Description)
	row.Name = name
	row.Description = &description
	row.Sort = input.Sort
	if err := s.repo.UpdateLoreCollection(row); err != nil {
		return nil, err
	}
	count, err := s.repo.LoreCollectionLoreCount(row.ID)
	if err != nil {
		return nil, err
	}
	output := loreCollectionOutput(*row, count)
	return &output, nil
}

func (s *Service) DeleteLoreCollection(userID uint64, projectPublicID, collectionPublicID string) error {
	project, err := s.repo.ProjectByPublicIDForUser(userID, projectPublicID)
	if err != nil {
		return err
	}
	row, err := s.repo.LoreCollection(project.ID, strings.TrimSpace(collectionPublicID))
	if err != nil {
		return err
	}
	count, err := s.repo.LoreCollectionLoreCount(row.ID)
	if err != nil {
		return err
	}
	if count > 0 {
		return errors.New("collection 內仍有設定集，不能刪除")
	}
	return s.repo.DeleteLoreCollection(row)
}

func (s *Service) MoveLore(userID uint64, projectPublicID, lorePublicID string, input storytellerModel.LoreMoveRequest) (*storytellerModel.Lore, error) {
	project, err := s.repo.ProjectByPublicIDForUser(userID, projectPublicID)
	if err != nil {
		return nil, err
	}
	lore, err := s.repo.Lore(project.ID, strings.TrimSpace(lorePublicID))
	if err != nil {
		return nil, err
	}
	collectionID, err := s.resolveLoreCollectionID(project.ID, input.CollectionID)
	if err != nil {
		return nil, err
	}
	lore.CollectionID = collectionID
	if err := s.repo.MoveLore(lore); err != nil {
		return nil, err
	}
	return lore, s.fillLoreCollectionPublicID(project.ID, lore)
}

func loreCollectionOutput(row storytellerModel.LoreCollection, loreCount int64) storytellerModel.LoreCollectionOutput {
	return storytellerModel.LoreCollectionOutput{
		ID:          row.ID,
		PublicID:    row.PublicID,
		ProjectID:   row.ProjectID,
		Name:        row.Name,
		Description: loreCollectionDescription(row.Description),
		Sort:        row.Sort,
		LoreCount:   loreCount,
		CreatedAt:   row.CreatedAt,
		UpdatedAt:   row.UpdatedAt,
	}
}

func loreCollectionDescription(description *string) string {
	if description == nil {
		return ""
	}
	return strings.TrimSpace(*description)
}
