package storyteller

import (
	"crypto/rand"
	"encoding/hex"
	"errors"
	"fmt"
	"regexp"
	"strings"

	storytellerModel "faryne.dev/model/entity/storyteller"
	"faryne.dev/repository"
	authRepo "faryne.dev/repository/auth"
	storytellerRepo "faryne.dev/repository/storyteller"
)

var whitespaceRegexp = regexp.MustCompile(`\s+`)
var unsafeSlugRegexp = regexp.MustCompile(`[^\p{L}\p{N}._~-]+`)
var slugUnderscoreRegexp = regexp.MustCompile(`_+`)

type Service struct {
	repo *storytellerRepo.Repository
}

func NewService() *Service {
	return &Service{repo: storytellerRepo.NewRepository()}
}

func (s *Service) PublicProjects() ([]storytellerModel.ProjectOutput, error) {
	projects, err := s.repo.PublicProjects()
	if err != nil {
		return nil, err
	}
	return s.projectOutputs(projects)
}

func (s *Service) PublicProject(projectValue string) (*storytellerModel.ProjectOutput, error) {
	publicID := strings.SplitN(projectValue, "-", 2)[0]
	project, err := s.repo.ProjectByPublicID(publicID)
	if err != nil {
		return nil, err
	}
	return s.projectOutput(project)
}

func (s *Service) SharedProject(token string) (*storytellerModel.ProjectOutput, error) {
	project, err := s.repo.ProjectByShareToken(strings.TrimSpace(token))
	if err != nil {
		return nil, err
	}
	return s.projectOutput(project)
}

func (s *Service) Projects(userID uint64) ([]storytellerModel.ProjectOutput, error) {
	projects, err := s.repo.Projects(userID)
	if err != nil {
		return nil, err
	}
	return s.projectOutputs(projects)
}

func (s *Service) Project(userID uint64, publicID string) (*storytellerModel.ProjectOutput, error) {
	project, err := s.repo.ProjectByPublicIDForUser(userID, publicID)
	if err != nil {
		return nil, err
	}
	return s.projectOutput(project)
}

func (s *Service) CreateProject(userID uint64, input storytellerModel.ProjectRequest) (*storytellerModel.ProjectOutput, error) {
	input = normalizeProjectRequest(input)
	if err := validateProject(input); err != nil {
		return nil, err
	}
	project := &storytellerModel.Project{
		PublicID:    randomID(),
		UserID:      userID,
		Name:        strings.TrimSpace(input.Name),
		Slug:        safeProjectSlug(input.Name),
		Description: strings.TrimSpace(input.Description),
		Visibility:  input.Visibility,
	}
	if project.Visibility == storytellerModel.ProjectVisibilityUnlisted {
		project.ShareToken = randomID() + randomID()
	}
	if err := s.repo.CreateProject(project); err != nil {
		return nil, err
	}
	return outputProject(*project), nil
}

func (s *Service) UpdateProject(userID uint64, publicID string, input storytellerModel.ProjectRequest) (*storytellerModel.ProjectOutput, error) {
	input = normalizeProjectRequest(input)
	if err := validateProject(input); err != nil {
		return nil, err
	}
	project, err := s.repo.ProjectByPublicIDForUser(userID, publicID)
	if err != nil {
		return nil, err
	}
	project.Name = strings.TrimSpace(input.Name)
	project.Description = strings.TrimSpace(input.Description)
	project.Visibility = input.Visibility
	if project.Visibility == storytellerModel.ProjectVisibilityUnlisted && project.ShareToken == "" {
		project.ShareToken = randomID() + randomID()
	}
	if err := s.repo.UpdateProject(project); err != nil {
		return nil, err
	}
	return s.projectOutput(project)
}

func (s *Service) DeleteProject(userID uint64, publicID string) error {
	project, err := s.repo.ProjectByPublicIDForUser(userID, publicID)
	if err != nil {
		return err
	}
	return s.repo.DeleteProject(project)
}

func (s *Service) Agents(userID uint64) ([]storytellerModel.Agent, error) {
	return s.repo.Agents(userID)
}

func (s *Service) Agent(userID, id uint64) (*storytellerModel.Agent, error) {
	return s.repo.Agent(userID, id)
}

func (s *Service) CreateAgent(userID uint64, input storytellerModel.AgentRequest) (*storytellerModel.Agent, error) {
	input = normalizeAgentRequest(input)
	if err := validateAgent(input, true); err != nil {
		return nil, err
	}
	agent := &storytellerModel.Agent{
		UserID:        userID,
		Name:          strings.TrimSpace(input.Name),
		Provider:      input.Provider,
		ModelName:     strings.TrimSpace(input.ModelName),
		APIKey:        strings.TrimSpace(input.APIKey),
		DefaultPrompt: strings.TrimSpace(input.DefaultPrompt),
	}
	if err := s.repo.CreateAgent(agent); err != nil {
		return nil, err
	}
	return agent, nil
}

func (s *Service) UpdateAgent(userID, id uint64, input storytellerModel.AgentRequest) (*storytellerModel.Agent, error) {
	input = normalizeAgentRequest(input)
	if err := validateAgent(input, false); err != nil {
		return nil, err
	}
	agent, err := s.repo.Agent(userID, id)
	if err != nil {
		return nil, err
	}
	agent.Name = strings.TrimSpace(input.Name)
	agent.Provider = input.Provider
	agent.ModelName = strings.TrimSpace(input.ModelName)
	if strings.TrimSpace(input.APIKey) != "" {
		agent.APIKey = strings.TrimSpace(input.APIKey)
	}
	agent.DefaultPrompt = strings.TrimSpace(input.DefaultPrompt)
	if err := s.repo.UpdateAgent(agent); err != nil {
		return nil, err
	}
	return agent, nil
}

func (s *Service) DeleteAgent(userID, id uint64) error {
	agent, err := s.repo.Agent(userID, id)
	if err != nil {
		return err
	}
	return s.repo.DeleteAgent(agent)
}

func (s *Service) Stories(userID uint64, projectPublicID string) ([]storytellerModel.Story, error) {
	project, err := s.repo.ProjectByPublicIDForUser(userID, projectPublicID)
	if err != nil {
		return nil, err
	}
	return s.repo.Stories(project.ID)
}

func (s *Service) Story(userID uint64, projectPublicID, storyPublicID string) (*storytellerModel.Story, error) {
	project, err := s.repo.ProjectByPublicIDForUser(userID, projectPublicID)
	if err != nil {
		return nil, err
	}
	return s.repo.Story(project.ID, storyPublicID)
}

func (s *Service) CreateStory(userID uint64, projectPublicID string, input storytellerModel.StoryRequest) (*storytellerModel.Story, error) {
	if err := validateStory(input); err != nil {
		return nil, err
	}
	project, err := s.repo.ProjectByPublicIDForUser(userID, projectPublicID)
	if err != nil {
		return nil, err
	}
	story := &storytellerModel.Story{
		PublicID:      randomID(),
		ProjectID:     project.ID,
		Title:         strings.TrimSpace(input.Title),
		Summary:       strings.TrimSpace(input.Summary),
		Sort:          input.Sort,
		LatestContent: input.Content,
		WordCount:     wordCount(input.Content),
	}
	version := buildStoryVersion(*story)
	if err := s.repo.CreateStoryWithVersion(story, version); err != nil {
		return nil, err
	}
	return story, nil
}

func (s *Service) UpdateStory(userID uint64, projectPublicID, storyPublicID string, input storytellerModel.StoryRequest) (*storytellerModel.Story, error) {
	if err := validateStory(input); err != nil {
		return nil, err
	}
	project, err := s.repo.ProjectByPublicIDForUser(userID, projectPublicID)
	if err != nil {
		return nil, err
	}
	story, err := s.repo.Story(project.ID, storyPublicID)
	if err != nil {
		return nil, err
	}
	story.Title = strings.TrimSpace(input.Title)
	story.Summary = strings.TrimSpace(input.Summary)
	story.Sort = input.Sort
	story.LatestContent = input.Content
	story.WordCount = wordCount(input.Content)
	version := buildStoryVersion(*story)
	if err := s.repo.UpdateStoryWithVersion(story, version); err != nil {
		return nil, err
	}
	return story, nil
}

func (s *Service) DeleteStory(userID uint64, projectPublicID, storyPublicID string) error {
	project, err := s.repo.ProjectByPublicIDForUser(userID, projectPublicID)
	if err != nil {
		return err
	}
	story, err := s.repo.Story(project.ID, storyPublicID)
	if err != nil {
		return err
	}
	return s.repo.DeleteStory(story)
}

func (s *Service) StoryVersions(userID uint64, projectPublicID, storyPublicID string) ([]storytellerModel.StoryVersion, error) {
	story, err := s.storyForUserProject(userID, projectPublicID, storyPublicID)
	if err != nil {
		return nil, err
	}
	return s.repo.StoryVersions(story.ID)
}

func (s *Service) StoryVersion(userID uint64, projectPublicID, storyPublicID string, versionID uint64) (*storytellerModel.StoryVersion, error) {
	story, err := s.storyForUserProject(userID, projectPublicID, storyPublicID)
	if err != nil {
		return nil, err
	}
	return s.repo.StoryVersion(story.ID, versionID)
}

func (s *Service) PublicUserProjects(penName string, page, pageSize int) ([]storytellerModel.ProjectOutput, int64, error) {
	if page < 1 {
		page = 1
	}
	if pageSize < 1 {
		pageSize = 20
	}
	profile, err := s.repo.UserProfileByPenName(penName)
	if err != nil {
		return nil, 0, err
	}
	projects, total, err := s.repo.PublicProjectsByUserID(profile.UserID, (page-1)*pageSize, pageSize)
	if err != nil {
		return nil, 0, err
	}
	outputs, err := s.projectOutputs(projects)
	return outputs, total, err
}

func (s *Service) FavoriteProjects(userID uint64) ([]storytellerModel.ProjectOutput, error) {
	projects, err := s.repo.FavoriteProjects(userID)
	if err != nil {
		return nil, err
	}
	return s.projectOutputs(projects)
}

func (s *Service) FavoriteStatus(userID uint64, projectPublicID string) (map[string]bool, error) {
	project, err := s.repo.ProjectByPublicIDForFavorite(projectPublicID)
	if err != nil {
		return nil, err
	}
	ranking, err := s.repo.Ranking(userID, project.ID)
	if err != nil {
		return map[string]bool{"favorited": false}, nil
	}
	return map[string]bool{"favorited": ranking.DeletedAt == nil && ranking.IsFavorite}, nil
}

func (s *Service) CreateFavorite(userID uint64, projectPublicID string) (*storytellerModel.ProjectOutput, error) {
	project, err := s.repo.ProjectByPublicIDForFavorite(projectPublicID)
	if err != nil {
		return nil, err
	}
	ranking, err := s.repo.Ranking(userID, project.ID)
	if err == nil {
		ranking.DeletedAt = nil
		ranking.IsFavorite = true
		if err := s.repo.SaveRanking(ranking); err != nil {
			return nil, err
		}
		return s.projectOutput(project)
	}
	if err := s.repo.CreateRanking(&storytellerModel.ProjectRanking{
		UserID:     userID,
		ProjectID:  project.ID,
		IsFavorite: true,
	}); err != nil {
		return nil, err
	}
	return s.projectOutput(project)
}

func (s *Service) DeleteFavorite(userID uint64, projectPublicID string) error {
	project, err := s.repo.ProjectByPublicIDForFavorite(projectPublicID)
	if err != nil {
		return err
	}
	ranking, err := s.repo.Ranking(userID, project.ID)
	if err != nil {
		return nil
	}
	ranking.IsFavorite = false
	return s.repo.SaveRanking(ranking)
}

func (s *Service) RankingStatus(userID uint64, projectPublicID string) (*storytellerModel.ProjectRankingOutput, error) {
	project, err := s.repo.ProjectByPublicIDForFavorite(projectPublicID)
	if err != nil {
		return nil, err
	}
	ranking, err := s.repo.Ranking(userID, project.ID)
	if err != nil || ranking.DeletedAt != nil {
		return &storytellerModel.ProjectRankingOutput{}, nil
	}
	return &storytellerModel.ProjectRankingOutput{Ranking: ranking.Ranking}, nil
}

func (s *Service) SaveRanking(userID uint64, projectPublicID string, input storytellerModel.ProjectRankingRequest) (*storytellerModel.ProjectRankingOutput, error) {
	if input.Ranking < 0.5 || input.Ranking > 5 || input.Ranking*2 != float64(int(input.Ranking*2)) {
		return nil, errors.New("ranking must be between 0.5 and 5 by 0.5 step")
	}
	project, err := s.repo.ProjectByPublicIDForFavorite(projectPublicID)
	if err != nil {
		return nil, err
	}
	value := input.Ranking
	ranking, err := s.repo.Ranking(userID, project.ID)
	if err == nil {
		ranking.DeletedAt = nil
		ranking.Ranking = &value
		if err := s.repo.SaveRanking(ranking); err != nil {
			return nil, err
		}
		return &storytellerModel.ProjectRankingOutput{Ranking: &value}, nil
	}
	if err := s.repo.CreateRanking(&storytellerModel.ProjectRanking{
		UserID:    userID,
		ProjectID: project.ID,
		Ranking:   &value,
	}); err != nil {
		return nil, err
	}
	return &storytellerModel.ProjectRankingOutput{Ranking: &value}, nil
}

func (s *Service) DeleteRanking(userID uint64, projectPublicID string) error {
	project, err := s.repo.ProjectByPublicIDForFavorite(projectPublicID)
	if err != nil {
		return err
	}
	ranking, err := s.repo.Ranking(userID, project.ID)
	if err != nil {
		return nil
	}
	ranking.Ranking = nil
	return s.repo.SaveRanking(ranking)
}

func (s *Service) UserProfile(userID uint64) (*storytellerModel.UserProfileOutput, error) {
	profile, err := s.repo.UserProfile(userID)
	if err != nil {
		if repository.IsRecordNotFound(err) {
			return defaultUserProfileOutput(userID), nil
		}
		return nil, err
	}
	return userProfileOutput(profile), nil
}

func (s *Service) SaveUserProfile(userID uint64, input storytellerModel.UserProfileRequest) (*storytellerModel.UserProfileOutput, error) {
	input = normalizeUserProfileRequest(input)
	profile, err := s.repo.UserProfileWithDeleted(userID)
	if err == nil {
		profile.PenName = input.PenName
		profile.Bio = input.Bio
		profile.UseDefaultAvatar = input.UseDefaultAvatar
		profile.AvatarURL = input.AvatarURL
		profile.DeletedAt = nil
		if err := s.repo.SaveUserProfile(profile); err != nil {
			return nil, err
		}
		return userProfileOutput(profile), nil
	}
	if !repository.IsRecordNotFound(err) {
		return nil, err
	}
	profile = &storytellerModel.UserProfile{
		UserID:           userID,
		PenName:          input.PenName,
		Bio:              input.Bio,
		UseDefaultAvatar: input.UseDefaultAvatar,
		AvatarURL:        input.AvatarURL,
	}
	if err := s.repo.CreateUserProfile(profile); err != nil {
		return nil, err
	}
	return userProfileOutput(profile), nil
}

func (s *Service) DeleteUserProfile(userID uint64) error {
	profile, err := s.repo.UserProfile(userID)
	if err != nil {
		if repository.IsRecordNotFound(err) {
			return nil
		}
		return err
	}
	return s.repo.DeleteUserProfile(profile)
}

func (s *Service) projectOutput(project *storytellerModel.Project) (*storytellerModel.ProjectOutput, error) {
	output := outputProject(*project)
	ratingCount, averageRating, err := s.repo.RankingSummary(project.ID)
	if err != nil {
		return nil, err
	}
	output.RatingCount = ratingCount
	output.AverageRating = averageRating
	stories, err := s.repo.Stories(project.ID)
	if err != nil {
		return nil, err
	}
	output.Stories = stories
	author, err := s.authorOutput(project.UserID)
	if err != nil {
		return nil, err
	}
	output.Author = author
	return output, nil
}

func (s *Service) authorOutput(userID uint64) (*storytellerModel.UserProfileOutput, error) {
	profile, err := s.repo.UserProfile(userID)
	if err != nil && !repository.IsRecordNotFound(err) {
		return nil, err
	}
	if err == nil {
		output := userProfileOutput(profile)
		if output.PenName != "" {
			return output, nil
		}
		output.PenName = fallbackAuthorName(userID)
		return output, nil
	}
	return &storytellerModel.UserProfileOutput{
		UserID:           userID,
		PenName:          fallbackAuthorName(userID),
		UseDefaultAvatar: true,
	}, nil
}

func (s *Service) storyForUserProject(userID uint64, projectPublicID, storyPublicID string) (*storytellerModel.Story, error) {
	project, err := s.repo.ProjectByPublicIDForUser(userID, projectPublicID)
	if err != nil {
		return nil, err
	}
	return s.repo.Story(project.ID, storyPublicID)
}

func (s *Service) projectOutputs(projects []storytellerModel.Project) ([]storytellerModel.ProjectOutput, error) {
	output := make([]storytellerModel.ProjectOutput, 0, len(projects))
	for _, project := range projects {
		row, err := s.projectOutput(&project)
		if err != nil {
			return nil, err
		}
		output = append(output, *row)
	}
	return output, nil
}

func outputProject(project storytellerModel.Project) *storytellerModel.ProjectOutput {
	return &storytellerModel.ProjectOutput{Project: project}
}

func defaultUserProfileOutput(userID uint64) *storytellerModel.UserProfileOutput {
	return &storytellerModel.UserProfileOutput{
		UserID:           userID,
		UseDefaultAvatar: true,
	}
}

func userProfileOutput(profile *storytellerModel.UserProfile) *storytellerModel.UserProfileOutput {
	return &storytellerModel.UserProfileOutput{
		UserID:           profile.UserID,
		PenName:          profile.PenName,
		Bio:              profile.Bio,
		UseDefaultAvatar: profile.UseDefaultAvatar,
		AvatarURL:        profile.AvatarURL,
	}
}

func fallbackAuthorName(userID uint64) string {
	user, err := authRepo.NewUserRepository().UserByID(userID)
	if err != nil {
		return ""
	}
	if user.DisplayName != nil && strings.TrimSpace(*user.DisplayName) != "" {
		return strings.TrimSpace(*user.DisplayName)
	}
	if user.Email != nil && strings.TrimSpace(*user.Email) != "" {
		return strings.TrimSpace(*user.Email)
	}
	return ""
}

func buildStoryVersion(story storytellerModel.Story) *storytellerModel.StoryVersion {
	return &storytellerModel.StoryVersion{
		StoryID:   story.ID,
		Title:     story.Title,
		Summary:   story.Summary,
		Content:   story.LatestContent,
		WordCount: story.WordCount,
	}
}

func wordCount(content string) uint {
	normalized := whitespaceRegexp.ReplaceAllString(content, "")
	return uint(len([]rune(normalized)))
}

func safeProjectSlug(name string) string {
	slug := unsafeSlugRegexp.ReplaceAllString(strings.TrimSpace(name), "_")
	slug = slugUnderscoreRegexp.ReplaceAllString(slug, "_")
	slug = strings.Trim(slug, "_")
	if slug == "" {
		return randomID()
	}
	return slug
}

func normalizeProjectRequest(input storytellerModel.ProjectRequest) storytellerModel.ProjectRequest {
	if input.Visibility == "" {
		input.Visibility = storytellerModel.ProjectVisibilityPrivate
	}
	return input
}

func validateProject(input storytellerModel.ProjectRequest) error {
	if strings.TrimSpace(input.Name) == "" {
		return errors.New("name is required")
	}
	switch input.Visibility {
	case storytellerModel.ProjectVisibilityPublic, storytellerModel.ProjectVisibilityUnlisted, storytellerModel.ProjectVisibilityPrivate:
		return nil
	default:
		return fmt.Errorf("invalid visibility")
	}
}

func normalizeAgentRequest(input storytellerModel.AgentRequest) storytellerModel.AgentRequest {
	if input.Provider == "" {
		input.Provider = storytellerModel.AgentProviderGrok
	}
	return input
}

func normalizeUserProfileRequest(input storytellerModel.UserProfileRequest) storytellerModel.UserProfileRequest {
	input.PenName = strings.TrimSpace(input.PenName)
	input.Bio = strings.TrimSpace(input.Bio)
	input.AvatarURL = strings.TrimSpace(input.AvatarURL)
	if input.UseDefaultAvatar {
		input.AvatarURL = ""
	}
	return input
}

func validateAgent(input storytellerModel.AgentRequest, requireAPIKey bool) error {
	if strings.TrimSpace(input.Name) == "" {
		return errors.New("name is required")
	}
	if input.Provider != storytellerModel.AgentProviderGrok {
		return errors.New("invalid provider")
	}
	if strings.TrimSpace(input.ModelName) == "" {
		return errors.New("model_name is required")
	}
	if requireAPIKey && strings.TrimSpace(input.APIKey) == "" {
		return errors.New("api_key is required")
	}
	return nil
}

func validateStory(input storytellerModel.StoryRequest) error {
	if strings.TrimSpace(input.Title) == "" {
		return errors.New("title is required")
	}
	return nil
}

func randomID() string {
	buf := make([]byte, 8)
	if _, err := rand.Read(buf); err != nil {
		return ""
	}
	return hex.EncodeToString(buf)
}
