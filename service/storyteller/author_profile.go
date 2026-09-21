package storyteller

import (
	"crypto/md5"
	"errors"
	"fmt"
	"sort"
	"strings"

	storytellerModel "faryne.dev/model/entity/storyteller"
	"faryne.dev/repository"
	"gorm.io/gorm"
)

var errPenNameTaken = errors.New("這個筆名已經有人使用了，請換一個")

func (s *Service) AuthorProfiles(userID uint64) ([]storytellerModel.AuthorProfileOutput, error) {
	rows, err := s.repo.AuthorProfilesByUserID(userID)
	if err != nil {
		return nil, err
	}
	outputs := make([]storytellerModel.AuthorProfileOutput, 0, len(rows))
	for i := range rows {
		outputs = append(outputs, authorProfileOutput(&rows[i]))
	}
	return outputs, nil
}

func (s *Service) CreateAuthorProfile(userID uint64, input storytellerModel.AuthorProfileRequest) (*storytellerModel.AuthorProfileOutput, error) {
	input = normalizeAuthorProfileRequest(input)
	if err := validatePenName(input.PenName); err != nil {
		return nil, err
	}
	if err := validateSNSLinks(input.SNSLinks); err != nil {
		return nil, err
	}
	// 建立額外筆名時 userID 傳 0：不能放行「跟自己本人 pen_name 同名」（那個豁免只給本人改自己名字用）
	if err := s.ensurePenNameAvailable(0, input.PenName, 0); err != nil {
		return nil, err
	}
	count, err := s.repo.AuthorProfileCount(userID)
	if err != nil {
		return nil, err
	}
	if count >= int64(FreeMaxProfiles) {
		return nil, fmt.Errorf("額外筆名數量已達上限（%d 個）", FreeMaxProfiles)
	}
	row := &storytellerModel.AuthorProfile{
		UserID:           userID,
		PenName:          input.PenName,
		Bio:              input.Bio,
		UseDefaultAvatar: input.UseDefaultAvatar,
		AvatarURL:        input.AvatarURL,
		SNSLinks:         input.SNSLinks,
	}
	if err := s.repo.CreateAuthorProfile(row); err != nil {
		return nil, err
	}
	output := authorProfileOutput(row)
	return &output, nil
}

func (s *Service) UpdateAuthorProfile(userID, profileID uint64, input storytellerModel.AuthorProfileRequest) (*storytellerModel.AuthorProfileOutput, error) {
	input = normalizeAuthorProfileRequest(input)
	if err := validatePenName(input.PenName); err != nil {
		return nil, err
	}
	if err := validateSNSLinks(input.SNSLinks); err != nil {
		return nil, err
	}
	row, err := s.repo.AuthorProfileByIDForUser(userID, profileID)
	if err != nil {
		return nil, err
	}
	if err := s.ensurePenNameAvailable(userID, input.PenName, row.ID); err != nil {
		return nil, err
	}
	renamed := row.PenName != input.PenName
	row.PenName = input.PenName
	row.Bio = input.Bio
	row.UseDefaultAvatar = input.UseDefaultAvatar
	row.AvatarURL = input.AvatarURL
	row.SNSLinks = input.SNSLinks
	if err := s.repo.SaveAuthorProfile(row); err != nil {
		return nil, err
	}
	if renamed {
		s.resyncIdentitySearchIndex(userID, row.ID)
	}
	output := authorProfileOutput(row)
	return &output, nil
}

func (s *Service) DeleteAuthorProfile(userID, profileID uint64) error {
	row, err := s.repo.AuthorProfileByIDForUser(userID, profileID)
	if err != nil {
		return err
	}
	used, err := s.repo.StoryProfileCountByProfileID(row.ID)
	if err != nil {
		return err
	}
	if used > 0 {
		return errors.New("仍有故事署名此筆名，請先改署名後再刪除")
	}
	return s.repo.DeleteAuthorProfile(row)
}

func (s *Service) SetStoryProfiles(userID uint64, projectPublicID, storyPublicID string, profileIDs []uint64) (*storytellerModel.Story, error) {
	project, err := s.repo.ProjectByPublicIDForUser(userID, projectPublicID)
	if err != nil {
		return nil, err
	}
	story, err := s.repo.Story(project.ID, storyPublicID)
	if err != nil {
		return nil, err
	}
	ids, err := s.resolveStoryProfileIDs(userID, &profileIDs, true)
	if err != nil {
		return nil, err
	}
	if err := s.repo.ReplaceStoryProfiles(story.ID, ids); err != nil {
		return nil, err
	}
	s.syncStorySearchIndex(project, story)
	return s.Story(userID, projectPublicID, storyPublicID)
}

func (s *Service) resolveStoryProfileIDs(userID uint64, input *[]uint64, isCreate bool) ([]uint64, error) {
	if input == nil {
		if isCreate {
			return []uint64{0}, nil
		}
		return nil, nil
	}
	ids := uniqueUint64(*input)
	if len(ids) == 0 {
		return []uint64{0}, nil
	}
	extraIDs := make([]uint64, 0, len(ids))
	for _, id := range ids {
		if id != 0 {
			extraIDs = append(extraIDs, id)
		}
	}
	if len(extraIDs) == 0 {
		return ids, nil
	}
	profiles, err := s.repo.AuthorProfilesByIDs(extraIDs)
	if err != nil {
		return nil, err
	}
	for _, id := range extraIDs {
		profile, ok := profiles[id]
		if !ok || profile.UserID != userID {
			return nil, errors.New("署名只能使用自己的筆名")
		}
	}
	return ids, nil
}

func (s *Service) profileIDsFromPenNames(userID uint64, names []string) ([]uint64, error) {
	self, err := s.repo.UserProfile(userID)
	if err != nil && !repository.IsRecordNotFound(err) {
		return nil, err
	}
	extras, err := s.repo.AuthorProfilesByUserID(userID)
	if err != nil {
		return nil, err
	}
	nameToID := map[string]uint64{}
	if self != nil && strings.TrimSpace(self.PenName) != "" {
		nameToID[self.PenName] = 0
	}
	for _, extra := range extras {
		nameToID[extra.PenName] = extra.ID
	}
	ids := make([]uint64, 0, len(names))
	for _, name := range names {
		name = strings.TrimSpace(name)
		if name == "" {
			continue
		}
		id, ok := nameToID[name]
		if !ok {
			return nil, fmt.Errorf("找不到筆名「%s」", name)
		}
		ids = append(ids, id)
	}
	if len(ids) == 0 {
		return []uint64{0}, nil
	}
	return uniqueUint64(ids), nil
}

type resolvedAuthorIdentity struct {
	UserID    uint64
	ProfileID uint64
	Self      *storytellerModel.UserProfile
	Extra     *storytellerModel.AuthorProfile
}

func (s *Service) resolveAuthorIdentityByPenName(penName string) (*resolvedAuthorIdentity, error) {
	penName = strings.TrimSpace(penName)
	if penName == "" {
		return nil, gorm.ErrRecordNotFound
	}
	self, err := s.repo.UserProfileByPenName(penName)
	if err == nil {
		return &resolvedAuthorIdentity{UserID: self.ID, ProfileID: 0, Self: self}, nil
	}
	if !repository.IsRecordNotFound(err) {
		return nil, err
	}
	extra, err := s.repo.AuthorProfileByPenName(penName)
	if err != nil {
		return nil, err
	}
	owner, err := s.repo.UserProfile(extra.UserID)
	if err != nil && !repository.IsRecordNotFound(err) {
		return nil, err
	}
	return &resolvedAuthorIdentity{UserID: extra.UserID, ProfileID: extra.ID, Self: owner, Extra: extra}, nil
}

func (identity *resolvedAuthorIdentity) output() storytellerModel.AuthorIdentityOutput {
	if identity.Extra != nil {
		return extraIdentityOutput(identity.Extra)
	}
	if identity.Self != nil {
		return selfIdentityOutput(identity.Self)
	}
	return storytellerModel.AuthorIdentityOutput{}
}

func (s *Service) favoriteAuthorOutputForIdentity(identity *resolvedAuthorIdentity) (*storytellerModel.FavoriteAuthorOutput, error) {
	projectCount, storyCount, imageStoryCount, ratingCount, followerCount, averageRating, err := s.repo.PublicAuthorSummary(identity.UserID, identity.ProfileID)
	if err != nil {
		return nil, err
	}
	return &storytellerModel.FavoriteAuthorOutput{
		AuthorIdentityOutput: identity.output(),
		ProjectCount:         projectCount,
		StoryCount:           storyCount,
		ImageStoryCount:      imageStoryCount,
		RatingCount:          ratingCount,
		AverageRating:        averageRating,
		FollowerCount:        followerCount,
		ShowFavorites:        identity.ProfileID == 0,
	}, nil
}

func (s *Service) attachProjectAuthors(outputs []*storytellerModel.ProjectOutput, includeProfileIDs bool, withFollowers bool) error {
	if len(outputs) == 0 {
		return nil
	}
	storyIDs := make([]uint64, 0)
	userIDs := make([]uint64, 0, len(outputs))
	seenUser := map[uint64]struct{}{}
	for _, output := range outputs {
		userID := output.UserID
		if _, ok := seenUser[userID]; !ok && userID != 0 {
			seenUser[userID] = struct{}{}
			userIDs = append(userIDs, userID)
		}
		for j := range output.Stories {
			storyIDs = append(storyIDs, output.Stories[j].ID)
		}
	}
	profileMap, err := s.repo.StoryProfilesByStoryIDs(storyIDs)
	if err != nil {
		return err
	}
	extraIDs := make([]uint64, 0)
	seenExtra := map[uint64]struct{}{}
	for _, ids := range profileMap {
		for _, id := range ids {
			if id != 0 {
				if _, ok := seenExtra[id]; !ok {
					seenExtra[id] = struct{}{}
					extraIDs = append(extraIDs, id)
				}
			}
		}
	}
	users, err := s.repo.UserProfilesByIDs(userIDs)
	if err != nil {
		return err
	}
	extras, err := s.repo.AuthorProfilesByIDs(extraIDs)
	if err != nil {
		return err
	}
	for _, output := range outputs {
		userID := output.UserID
		type counted struct {
			key    storytellerModel.AuthorIdentityKey
			count  int
			first  int
			output storytellerModel.AuthorIdentityOutput
		}
		byKey := map[storytellerModel.AuthorIdentityKey]*counted{}
		order := 0
		for j := range output.Stories {
			ids, ok := profileMap[output.Stories[j].ID]
			if !ok || len(ids) == 0 {
				ids = []uint64{0}
			}
			if includeProfileIDs {
				output.Stories[j].ProfileIDs = append([]uint64(nil), ids...)
			}
			authors := make([]storytellerModel.AuthorIdentityOutput, 0, len(ids))
			for _, profileID := range ids {
				key := storytellerModel.AuthorIdentityKey{UserID: userID, ProfileID: profileID}
				item, exists := byKey[key]
				if !exists {
					item = &counted{
						key:    key,
						first:  order,
						output: identityOutputFromMaps(userID, profileID, users, extras),
					}
					byKey[key] = item
					order++
				}
				item.count++
				authors = append(authors, item.output)
			}
			output.Stories[j].Authors = authors
		}
		ranked := make([]*counted, 0, len(byKey))
		for _, item := range byKey {
			ranked = append(ranked, item)
		}
		sort.Slice(ranked, func(a, b int) bool {
			if ranked[a].count != ranked[b].count {
				return ranked[a].count > ranked[b].count
			}
			return ranked[a].first < ranked[b].first
		})
		if len(ranked) == 0 {
			ranked = []*counted{{
				key:    storytellerModel.AuthorIdentityKey{UserID: userID, ProfileID: 0},
				output: identityOutputFromMaps(userID, 0, users, extras),
			}}
		}
		authors := make([]storytellerModel.ProjectAuthorOutput, 0, len(ranked))
		keys := make([]storytellerModel.AuthorIdentityKey, 0, len(ranked))
		for _, item := range ranked {
			authors = append(authors, storytellerModel.ProjectAuthorOutput{AuthorIdentityOutput: item.output})
			keys = append(keys, item.key)
		}
		if withFollowers {
			counts, err := s.repo.AuthorFollowerCounts(keys)
			if err != nil {
				return err
			}
			for i := range authors {
				count := counts[keys[i]]
				authors[i].FollowerCount = &count
			}
		}
		output.Authors = authors
	}
	return nil
}

func identityOutputFromMaps(
	userID, profileID uint64,
	users map[uint64]storytellerModel.UserProfile,
	extras map[uint64]storytellerModel.AuthorProfile,
) storytellerModel.AuthorIdentityOutput {
	if profileID != 0 {
		if extra, ok := extras[profileID]; ok {
			return extraIdentityOutput(&extra)
		}
		return storytellerModel.AuthorIdentityOutput{}
	}
	if user, ok := users[userID]; ok {
		return selfIdentityOutput(&user)
	}
	return storytellerModel.AuthorIdentityOutput{}
}

func selfIdentityOutput(profile *storytellerModel.UserProfile) storytellerModel.AuthorIdentityOutput {
	output := storytellerModel.AuthorIdentityOutput{
		PenName:          profile.PenName,
		Bio:              profile.Bio,
		UseDefaultAvatar: profile.UseDefaultAvatar,
		AvatarURL:        resolvedAvatarURL(profile),
		SNSLinks:         profile.SNSLinks,
		CreatedAt:        profile.CreatedAt,
	}
	if output.PenName == "" {
		output.PenName = fallbackAuthorName(profile)
	}
	return output
}

func extraIdentityOutput(profile *storytellerModel.AuthorProfile) storytellerModel.AuthorIdentityOutput {
	return storytellerModel.AuthorIdentityOutput{
		PenName:          profile.PenName,
		Bio:              profile.Bio,
		UseDefaultAvatar: profile.UseDefaultAvatar,
		AvatarURL:        resolvedExtraAvatarURL(profile),
		SNSLinks:         profile.SNSLinks,
		CreatedAt:        profile.CreatedAt,
	}
}

func authorProfileOutput(profile *storytellerModel.AuthorProfile) storytellerModel.AuthorProfileOutput {
	return storytellerModel.AuthorProfileOutput{
		ID:               profile.ID,
		PenName:          profile.PenName,
		Bio:              profile.Bio,
		UseDefaultAvatar: profile.UseDefaultAvatar,
		AvatarURL:        resolvedExtraAvatarURL(profile),
		SNSLinks:         profile.SNSLinks,
		CreatedAt:        profile.CreatedAt,
	}
}

func resolvedExtraAvatarURL(profile *storytellerModel.AuthorProfile) string {
	if profile.AvatarURL != "" {
		return profile.AvatarURL
	}
	hash := md5.Sum([]byte("pen-name:" + profile.PenName))
	return fmt.Sprintf("https://www.gravatar.com/avatar/%x?d=identicon", hash)
}

func uniqueUint64(ids []uint64) []uint64 {
	out := make([]uint64, 0, len(ids))
	seen := map[uint64]struct{}{}
	for _, id := range ids {
		if _, ok := seen[id]; ok {
			continue
		}
		seen[id] = struct{}{}
		out = append(out, id)
	}
	return out
}

func normalizeAuthorProfileRequest(input storytellerModel.AuthorProfileRequest) storytellerModel.AuthorProfileRequest {
	input.PenName = strings.TrimSpace(input.PenName)
	input.Bio = strings.TrimSpace(input.Bio)
	input.AvatarURL = strings.TrimSpace(input.AvatarURL)
	if input.UseDefaultAvatar {
		input.AvatarURL = ""
	}
	if input.SNSLinks != nil {
		links := make(storytellerModel.SNSLinks, len(input.SNSLinks))
		for key, value := range input.SNSLinks {
			key = strings.TrimSpace(key)
			value = strings.TrimSpace(value)
			if key == "" || value == "" {
				continue
			}
			links[key] = value
		}
		input.SNSLinks = links
	}
	return input
}

func (s *Service) resyncIdentitySearchIndex(userID, profileID uint64) {
	stories, err := s.repo.PublicStoriesByIdentity(userID, profileID)
	if err != nil {
		return
	}
	if len(stories) == 0 {
		return
	}
	projectIDs := make([]uint64, 0)
	seen := map[uint64]struct{}{}
	for i := range stories {
		if _, ok := seen[stories[i].ProjectID]; ok {
			continue
		}
		seen[stories[i].ProjectID] = struct{}{}
		projectIDs = append(projectIDs, stories[i].ProjectID)
	}
	projects := make(map[uint64]*storytellerModel.Project, len(projectIDs))
	for _, projectID := range projectIDs {
		project, err := s.repo.ProjectByID(projectID)
		if err != nil {
			continue
		}
		projects[projectID] = project
	}
	for i := range stories {
		project := projects[stories[i].ProjectID]
		if project == nil {
			continue
		}
		s.syncStorySearchIndex(project, &stories[i])
	}
}
