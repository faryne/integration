package storyteller

import (
	"errors"
	"strings"
	"time"

	storytellerModel "faryne.dev/model/entity/storyteller"
	"faryne.dev/repository"
	"gorm.io/gorm"
)

// 追蹤作者：追蹤關係多記一個「追蹤者用哪個身份」（follower_profile_id，0＝本人）。
// 以筆名做的追蹤只會出現在本人自己看得到的地方，任何公開輸出都只列本人身份的追蹤，
// 否則對方就能把筆名串回本人帳號。

var errCannotFollowSelf = errors.New("cannot favorite yourself")

// AuthorFavoriteStatusOutput 是作者頁追蹤按鈕的狀態：Favorited 只看本人身份，
// FollowingAs 是本人以哪些筆名追蹤這位作者（只回給本人自己，不會洩漏）。
type AuthorFavoriteStatusOutput struct {
	Favorited   bool     `json:"favorited"`
	FollowingAs []string `json:"following_as"`
}

// resolveFollowerProfile 把 as（筆名）轉成追蹤者身份 id；空字串或本人筆名都是 0，
// 不是自己的筆名回 record not found。
func (s *Service) resolveFollowerProfile(userID uint64, as string) (uint64, error) {
	as = strings.TrimSpace(as)
	if as == "" {
		return 0, nil
	}
	identity, err := s.resolveAuthorIdentityByPenName(as)
	if err != nil {
		return 0, err
	}
	if identity.UserID != userID {
		return 0, gorm.ErrRecordNotFound
	}
	return identity.ProfileID, nil
}

func (s *Service) AuthorFavoriteStatus(userID uint64, authorPenName string) (*AuthorFavoriteStatusOutput, error) {
	out := &AuthorFavoriteStatusOutput{FollowingAs: []string{}}
	identity, err := s.resolveAuthorIdentityByPenName(authorPenName)
	if err != nil {
		if repository.IsRecordNotFound(err) {
			return out, nil
		}
		return nil, err
	}
	favorites, err := s.repo.ActiveAuthorFavoritesTo(userID, []uint64{identity.UserID})
	if err != nil {
		return nil, err
	}
	extraIDs := make([]uint64, 0)
	for _, favorite := range favorites {
		if favorite.AuthorProfileID != identity.ProfileID {
			continue
		}
		if favorite.FollowerProfileID == 0 {
			out.Favorited = true
		} else {
			extraIDs = append(extraIDs, favorite.FollowerProfileID)
		}
	}
	extras, err := s.repo.AuthorProfilesByIDs(extraIDs)
	if err != nil {
		return nil, err
	}
	for _, id := range extraIDs {
		if extra, ok := extras[id]; ok && extra.UserID == userID {
			out.FollowingAs = append(out.FollowingAs, extra.PenName)
		}
	}
	return out, nil
}

// CreateAuthorFavorite 是作者頁的追蹤按鈕：一律以本人身份追蹤（v1 不提供選身份）。
func (s *Service) CreateAuthorFavorite(userID uint64, authorPenName string) (*storytellerModel.FavoriteAuthorOutput, error) {
	identity, err := s.resolveAuthorIdentityByPenName(authorPenName)
	if err != nil {
		return nil, err
	}
	return s.createAuthorFavorite(userID, 0, identity)
}

// createAuthorFavorite 建立（或恢復已取消的）追蹤，成功後通知被追蹤的作者。
func (s *Service) createAuthorFavorite(userID, followerProfileID uint64, identity *resolvedAuthorIdentity) (*storytellerModel.FavoriteAuthorOutput, error) {
	if userID == identity.UserID {
		return nil, errCannotFollowSelf
	}
	favorite, err := s.repo.AuthorFavorite(userID, followerProfileID, identity.UserID, identity.ProfileID)
	switch {
	case err == nil:
		if favorite.DeletedAt != nil {
			favorite.DeletedAt = nil
			if err := s.repo.SaveAuthorFavorite(favorite); err != nil {
				return nil, err
			}
		}
	case repository.IsRecordNotFound(err):
		if err := s.repo.CreateAuthorFavorite(&storytellerModel.AuthorFavorite{
			UserID: userID, FollowerProfileID: followerProfileID,
			AuthorUserID: identity.UserID, AuthorProfileID: identity.ProfileID,
		}); err != nil {
			return nil, err
		}
	default:
		return nil, err
	}
	s.notifyAuthorFollowed(storytellerModel.AuthorIdentityKey{UserID: userID, ProfileID: followerProfileID}, identity)
	return s.favoriteAuthorOutputForIdentity(identity)
}

// DeleteAuthorFavorite 取消追蹤；as 是以哪個筆名做的追蹤，空字串＝本人身份。
func (s *Service) DeleteAuthorFavorite(userID uint64, authorPenName, as string) error {
	identity, err := s.resolveAuthorIdentityByPenName(authorPenName)
	if err != nil {
		if repository.IsRecordNotFound(err) {
			return nil
		}
		return err
	}
	followerProfileID, err := s.resolveFollowerProfile(userID, as)
	if err != nil {
		return err
	}
	favorite, err := s.repo.AuthorFavorite(userID, followerProfileID, identity.UserID, identity.ProfileID)
	if err != nil {
		return nil
	}
	now := time.Now()
	favorite.DeletedAt = &now
	return s.repo.SaveAuthorFavorite(favorite)
}

// FavoriteAuthors 是本人自己的追蹤列表：本人與筆名的追蹤都列，筆名追蹤帶 As。
func (s *Service) FavoriteAuthors(userID uint64) ([]storytellerModel.FavoriteAuthorOutput, error) {
	favorites, err := s.repo.FavoriteAuthors(userID)
	if err != nil {
		return nil, err
	}
	followerIDs := make([]uint64, 0)
	for _, favorite := range favorites {
		if favorite.FollowerProfileID != 0 {
			followerIDs = append(followerIDs, favorite.FollowerProfileID)
		}
	}
	extras, err := s.repo.AuthorProfilesByIDs(followerIDs)
	if err != nil {
		return nil, err
	}
	outputs := make([]storytellerModel.FavoriteAuthorOutput, 0, len(favorites))
	for _, favorite := range favorites {
		as := ""
		if favorite.FollowerProfileID != 0 {
			// 筆名已刪除的追蹤會在刪筆名時一併取消；這裡查不到就略過，避免顯示沒有身份的追蹤
			extra, ok := extras[favorite.FollowerProfileID]
			if !ok {
				continue
			}
			as = extra.PenName
		}
		output, err := s.favoriteAuthorOutput(favorite.AuthorUserID, favorite.AuthorProfileID)
		if err != nil {
			return nil, err
		}
		output.Hidden, output.As = favorite.Hidden, as
		outputs = append(outputs, *output)
	}
	return outputs, nil
}

// PublicFavoriteAuthors 是作者頁的「追蹤的作家」分頁：
//   - 本人身份的作者頁：只列本人身份的追蹤（依隱藏設定）
//   - 筆名作者頁：只有擁有者看得到「此筆名追蹤的作家」，其他人一律空列表
func (s *Service) PublicFavoriteAuthors(penName string, viewerID uint64) ([]storytellerModel.FavoriteAuthorOutput, error) {
	identity, err := s.resolveAuthorIdentityByPenName(penName)
	if err != nil {
		return nil, err
	}
	if identity.ProfileID != 0 {
		if viewerID == 0 || viewerID != identity.UserID {
			return []storytellerModel.FavoriteAuthorOutput{}, nil
		}
		favorites, err := s.repo.FavoriteAuthorsByFollowerProfile(identity.UserID, identity.ProfileID)
		if err != nil {
			return nil, err
		}
		return s.favoriteAuthorOutputs(favorites)
	}
	profile := identity.Self
	if profile == nil {
		return []storytellerModel.FavoriteAuthorOutput{}, nil
	}
	isOwner := viewerID != 0 && viewerID == profile.ID
	if profile.HideFavoriteAuthors && !isOwner {
		return []storytellerModel.FavoriteAuthorOutput{}, nil
	}
	favorites, err := s.repo.PublicFavoriteAuthors(profile.ID, isOwner)
	if err != nil {
		return nil, err
	}
	return s.favoriteAuthorOutputs(favorites)
}

func (s *Service) favoriteAuthorOutputs(favorites []storytellerModel.AuthorFavorite) ([]storytellerModel.FavoriteAuthorOutput, error) {
	outputs := make([]storytellerModel.FavoriteAuthorOutput, 0, len(favorites))
	for _, favorite := range favorites {
		output, err := s.favoriteAuthorOutput(favorite.AuthorUserID, favorite.AuthorProfileID)
		if err != nil {
			return nil, err
		}
		output.Hidden = favorite.Hidden
		outputs = append(outputs, *output)
	}
	return outputs, nil
}
