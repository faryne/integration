package storyteller

import (
	"errors"
	"fmt"
	"slices"
	"strings"

	storytellerModel "faryne.dev/model/entity/storyteller"
	"faryne.dev/service/log"
	notifyService "faryne.dev/service/storytellernotify"
	"go.uber.org/zap"
)

// 被追蹤／被收藏通知與回追。回追一律用「被追蹤的那個身份」：讀者追蹤了我的筆名 P，
// 回追就是 P 追蹤對方，不是本人帳號，否則對方會立刻知道 P 是誰。

var (
	// ErrFollowBackUnavailable：對方身份或我可用來回追的身份已不存在，或這則通知不是追蹤類
	ErrFollowBackUnavailable = errors.New("follow back is unavailable")
	// ErrFollowBackIdentity：作品有多個署名身份卻沒指定 as，或 as 不是這部作品的署名身份
	ErrFollowBackIdentity = errors.New("follow back identity is required or invalid")
)

// anonymousReaderName 是追蹤者沒有設定筆名時的顯示名稱；不能用 fallbackAuthorName，它會退回 email。
const anonymousReaderName = "一位讀者"

const followNotificationBody = "可以到對方的創作者頁看看，或直接回追。"

type followRepository interface {
	UserProfilesByIDs(ids []uint64) (map[uint64]storytellerModel.UserProfile, error)
	AuthorProfilesByIDs(ids []uint64) (map[uint64]storytellerModel.AuthorProfile, error)
	ActiveAuthorFavoritesTo(userID uint64, authorUserIDs []uint64) ([]storytellerModel.AuthorFavorite, error)
	ProjectSigningProfiles(projectIDs []uint64) (map[uint64][]uint64, error)
}

func isFollowKind(kind storytellerModel.NotificationKind) bool {
	return kind == storytellerModel.NotificationKindAuthorFollowed || kind == storytellerModel.NotificationKindProjectFavorited
}

// identityBook 是一次批次載入的身份資料。
type identityBook struct {
	users  map[uint64]storytellerModel.UserProfile
	extras map[uint64]storytellerModel.AuthorProfile
}

func loadIdentityBook(repo followRepository, keys []storytellerModel.AuthorIdentityKey) (*identityBook, error) {
	userIDs, extraIDs := make([]uint64, 0, len(keys)), make([]uint64, 0, len(keys))
	for _, key := range keys {
		if key.ProfileID == 0 {
			userIDs = append(userIDs, key.UserID)
		} else {
			extraIDs = append(extraIDs, key.ProfileID)
		}
	}
	users, err := repo.UserProfilesByIDs(uniqueUint64(userIDs))
	if err != nil {
		return nil, err
	}
	extras, err := repo.AuthorProfilesByIDs(uniqueUint64(extraIDs))
	if err != nil {
		return nil, err
	}
	return &identityBook{users: users, extras: extras}, nil
}

// lookup 回傳身份的公開輸出；帳號／筆名已刪除、筆名不屬於該帳號、或沒有設定筆名（沒有創作者頁）時 ok=false。
func (b *identityBook) lookup(key storytellerModel.AuthorIdentityKey) (storytellerModel.AuthorIdentityOutput, bool) {
	if key.ProfileID != 0 {
		extra, ok := b.extras[key.ProfileID]
		if !ok || extra.UserID != key.UserID {
			return storytellerModel.AuthorIdentityOutput{}, false
		}
		return extraIdentityOutput(&extra), true
	}
	user, ok := b.users[key.UserID]
	if !ok || strings.TrimSpace(user.PenName) == "" {
		return storytellerModel.AuthorIdentityOutput{}, false
	}
	return selfIdentityOutput(&user), true
}

// displayName 是通知文字用的名字；查不到就是「一位讀者」。
func (b *identityBook) displayName(key storytellerModel.AuthorIdentityKey) string {
	if identity, ok := b.lookup(key); ok {
		return identity.PenName
	}
	return anonymousReaderName
}

// snapshot 是存進通知 payload 的追蹤者快照：只留筆名與頭像，自介、SNS 等輸出時再即時查；
// 沒有可連結的筆名時回 nil。
func (b *identityBook) snapshot(key storytellerModel.AuthorIdentityKey) *storytellerModel.AuthorIdentityOutput {
	identity, ok := b.lookup(key)
	if !ok {
		return nil
	}
	return &storytellerModel.AuthorIdentityOutput{PenName: identity.PenName, UseDefaultAvatar: identity.UseDefaultAvatar, AvatarURL: identity.AvatarURL, CreatedAt: identity.CreatedAt}
}

// resolved 轉成建立追蹤用的 resolvedAuthorIdentity；呼叫前要先確認 lookup 成功。
func (b *identityBook) resolved(key storytellerModel.AuthorIdentityKey) *resolvedAuthorIdentity {
	identity := &resolvedAuthorIdentity{UserID: key.UserID, ProfileID: key.ProfileID}
	if user, ok := b.users[key.UserID]; ok {
		identity.Self = &user
	}
	if extra, ok := b.extras[key.ProfileID]; ok && key.ProfileID != 0 {
		identity.Extra = &extra
	}
	return identity
}

// ---- 發送 ----

// authorFollowedInput 組「被追蹤」通知；收件人是被追蹤身份的擁有者帳號。
// group_key 綁定（追蹤者身份, 被追蹤身份），追蹤／取消／再追蹤反覆按只會有一則。
func authorFollowedInput(follower storytellerModel.AuthorIdentityKey, book *identityBook, author *resolvedAuthorIdentity) notifyService.Input {
	name := book.displayName(follower)
	payload := storytellerModel.NotificationPayload{
		Title: name + " 追蹤了你", Body: followNotificationBody, Actor: book.snapshot(follower),
		Internal: &storytellerModel.NotificationInternal{ActorUserID: follower.UserID, ActorProfileID: follower.ProfileID, TargetProfileID: author.ProfileID},
	}
	if author.ProfileID != 0 {
		payload.TargetPenName = author.output().PenName
		payload.Title = fmt.Sprintf("%s 追蹤了你的筆名 %s", name, payload.TargetPenName)
	}
	return notifyService.Input{
		UserID: author.UserID, Kind: storytellerModel.NotificationKindAuthorFollowed,
		GroupKey: fmt.Sprintf("%s:%d:%d:%d", storytellerModel.NotificationKindAuthorFollowed, follower.UserID, follower.ProfileID, author.ProfileID),
		Payload:  payload,
	}
}

// projectFavoritedInput 組「作品被收藏」通知；收藏一律是本人身份。
func projectFavoritedInput(userID uint64, book *identityBook, project *storytellerModel.Project, authors []string) notifyService.Input {
	follower := storytellerModel.AuthorIdentityKey{UserID: userID}
	payload := storytellerModel.NotificationPayload{
		Title: fmt.Sprintf("%s 收藏了你的作品《%s》", book.displayName(follower), project.Name), Body: followNotificationBody,
		ProjectPublicID: project.PublicID, ProjectSlug: project.Slug, ProjectName: project.Name, Rating: project.Rating, Authors: authors,
		Actor: book.snapshot(follower), Internal: &storytellerModel.NotificationInternal{ActorUserID: userID},
	}
	return notifyService.Input{
		UserID: project.UserID, Kind: storytellerModel.NotificationKindProjectFavorited,
		GroupKey:  fmt.Sprintf("%s:%d:%d", storytellerModel.NotificationKindProjectFavorited, userID, project.ID),
		ProjectID: &project.ID, Payload: payload,
	}
}

// sendFollowNotification 是追蹤／收藏的附屬動作：送不出去只記 log，不能讓追蹤本身失敗。
func sendFollowNotification(input notifyService.Input, err error) {
	if err == nil {
		err = notifyService.NewService().Notify([]notifyService.Input{input})
	}
	if err != nil {
		log.Logger().Error("Storyteller follow notification failed", zap.String("kind", string(input.Kind)), zap.Uint64("user_id", input.UserID), zap.Error(err))
	}
}

func (s *Service) notifyAuthorFollowed(follower storytellerModel.AuthorIdentityKey, author *resolvedAuthorIdentity) {
	book, err := loadIdentityBook(s.repo, []storytellerModel.AuthorIdentityKey{follower})
	if err != nil {
		sendFollowNotification(notifyService.Input{Kind: storytellerModel.NotificationKindAuthorFollowed, UserID: author.UserID}, err)
		return
	}
	sendFollowNotification(authorFollowedInput(follower, book, author), nil)
}

func (s *Service) notifyProjectFavorited(userID uint64, project *storytellerModel.Project) {
	if userID == project.UserID {
		return
	}
	input := notifyService.Input{Kind: storytellerModel.NotificationKindProjectFavorited, UserID: project.UserID}
	signing, err := s.repo.ProjectSigningProfiles([]uint64{project.ID})
	if err != nil {
		sendFollowNotification(input, err)
		return
	}
	keys := []storytellerModel.AuthorIdentityKey{{UserID: userID}}
	for _, profileID := range signing[project.ID] {
		keys = append(keys, storytellerModel.AuthorIdentityKey{UserID: project.UserID, ProfileID: profileID})
	}
	book, err := loadIdentityBook(s.repo, keys)
	if err != nil {
		sendFollowNotification(input, err)
		return
	}
	authors := make([]string, 0, len(keys)-1)
	for _, key := range keys[1:] {
		if identity, ok := book.lookup(key); ok {
			authors = append(authors, identity.PenName)
		}
	}
	sendFollowNotification(projectFavoritedInput(userID, book, project, authors), nil)
}

// ---- 輸出前補資料與回追 ----

type followBackCandidate struct {
	Key     storytellerModel.AuthorIdentityKey
	PenName string
}

// followBackPlan 是一則追蹤類通知目前的狀態：對方是誰、我能用哪些身份回追、是否已回追。
type followBackPlan struct {
	ActorKey   storytellerModel.AuthorIdentityKey
	Actor      *storytellerModel.AuthorIdentityOutput
	Target     *storytellerModel.AuthorIdentityOutput // 只有 author.followed：被追蹤的是我哪個身份
	Candidates []followBackCandidate
	State      storytellerModel.NotificationFollowBackState
}

// planFollowBacks 依通知的內部鍵即時查詢；非追蹤類或沒有內部鍵的通知對應 nil。
func planFollowBacks(repo followRepository, userID uint64, rows []storytellerModel.Notification) ([]*followBackPlan, *identityBook, error) {
	plans := make([]*followBackPlan, len(rows))
	projectIDs, actorUserIDs := make([]uint64, 0), make([]uint64, 0)
	for _, row := range rows {
		if !isFollowKind(row.Kind) || row.Payload.Internal == nil {
			continue
		}
		actorUserIDs = append(actorUserIDs, row.Payload.Internal.ActorUserID)
		if row.Kind == storytellerModel.NotificationKindProjectFavorited && row.ProjectID != nil {
			projectIDs = append(projectIDs, *row.ProjectID)
		}
	}
	if len(actorUserIDs) == 0 {
		return plans, nil, nil
	}
	signing, err := repo.ProjectSigningProfiles(uniqueUint64(projectIDs))
	if err != nil {
		return nil, nil, err
	}
	// 每則通知的候選身份：被追蹤的那個身份，或作品署名過的身份
	candidateKeys := make([][]storytellerModel.AuthorIdentityKey, len(rows))
	keys := make([]storytellerModel.AuthorIdentityKey, 0)
	for i, row := range rows {
		if !isFollowKind(row.Kind) || row.Payload.Internal == nil {
			continue
		}
		internal := row.Payload.Internal
		profileIDs := []uint64{internal.TargetProfileID}
		if row.Kind == storytellerModel.NotificationKindProjectFavorited {
			profileIDs = nil
			if row.ProjectID != nil {
				profileIDs = signing[*row.ProjectID]
			}
		}
		for _, profileID := range profileIDs {
			candidateKeys[i] = append(candidateKeys[i], storytellerModel.AuthorIdentityKey{UserID: userID, ProfileID: profileID})
		}
		keys = append(keys, storytellerModel.AuthorIdentityKey{UserID: internal.ActorUserID, ProfileID: internal.ActorProfileID})
		keys = append(keys, candidateKeys[i]...)
	}
	book, err := loadIdentityBook(repo, keys)
	if err != nil {
		return nil, nil, err
	}
	favorites, err := repo.ActiveAuthorFavoritesTo(userID, uniqueUint64(actorUserIDs))
	if err != nil {
		return nil, nil, err
	}
	// following[我的身份][對方身份]：目前已存在的追蹤
	type edge struct {
		follower uint64
		author   storytellerModel.AuthorIdentityKey
	}
	following := make(map[edge]struct{}, len(favorites))
	for _, favorite := range favorites {
		following[edge{favorite.FollowerProfileID, storytellerModel.AuthorIdentityKey{UserID: favorite.AuthorUserID, ProfileID: favorite.AuthorProfileID}}] = struct{}{}
	}

	for i, row := range rows {
		if !isFollowKind(row.Kind) || row.Payload.Internal == nil {
			continue
		}
		internal := row.Payload.Internal
		plan := &followBackPlan{
			ActorKey: storytellerModel.AuthorIdentityKey{UserID: internal.ActorUserID, ProfileID: internal.ActorProfileID},
			State:    storytellerModel.NotificationFollowBackNone,
		}
		if actor, ok := book.lookup(plan.ActorKey); ok {
			plan.Actor = &actor
		}
		if row.Kind == storytellerModel.NotificationKindAuthorFollowed {
			if target, ok := book.lookup(storytellerModel.AuthorIdentityKey{UserID: userID, ProfileID: internal.TargetProfileID}); ok {
				plan.Target = &target
			}
		}
		for _, key := range candidateKeys[i] {
			identity, ok := book.lookup(key)
			if !ok || slices.ContainsFunc(plan.Candidates, func(c followBackCandidate) bool { return c.Key == key }) {
				continue
			}
			plan.Candidates = append(plan.Candidates, followBackCandidate{Key: key, PenName: identity.PenName})
			if _, ok := following[edge{key.ProfileID, plan.ActorKey}]; ok {
				plan.State = storytellerModel.NotificationFollowBackFollowing
			}
		}
		if plan.Actor == nil || len(plan.Candidates) == 0 {
			plan.State = storytellerModel.NotificationFollowBackUnavailable
		}
		plans[i] = plan
	}
	return plans, book, nil
}

// decorateFollowNotifications 把追蹤者、被追蹤身份換成目前的筆名（改過名也能連到正確的創作者頁），
// 並補上回追狀態。對方身份已不存在時 Actor 設為 nil，前端顯示「已不存在的使用者」。
func decorateFollowNotifications(repo followRepository, userID uint64, rows []storytellerModel.Notification, outs []storytellerModel.NotificationOutput) error {
	plans, _, err := planFollowBacks(repo, userID, rows)
	if err != nil {
		return err
	}
	for i, plan := range plans {
		if plan == nil {
			continue
		}
		outs[i].Payload.Actor = plan.Actor
		// 被追蹤的是本人身份時 TargetPenName 一律留空；筆名已刪除就保留快照
		if rows[i].Kind == storytellerModel.NotificationKindAuthorFollowed {
			switch {
			case rows[i].Payload.Internal.TargetProfileID == 0:
				outs[i].Payload.TargetPenName = ""
			case plan.Target != nil:
				outs[i].Payload.TargetPenName = plan.Target.PenName
			}
		}
		followBack := &storytellerModel.NotificationFollowBack{State: plan.State, Identities: []storytellerModel.NotificationFollowBackIdentity{}}
		if plan.State != storytellerModel.NotificationFollowBackUnavailable {
			for _, candidate := range plan.Candidates {
				followBack.Identities = append(followBack.Identities, storytellerModel.NotificationFollowBackIdentity{
					PenName: candidate.PenName, IsSelf: candidate.Key.ProfileID == 0,
				})
			}
		}
		outs[i].FollowBack = followBack
	}
	return nil
}

// DecorateNotifications 掛在 storytellernotify 的輸出流程上（見 controller 的 notifyServiceForViewer）。
// 追蹤類補回追狀態，動態類補最新筆名與「已刪除」標記。
func (s *Service) DecorateNotifications(userID uint64, rows []storytellerModel.Notification, outs []storytellerModel.NotificationOutput) error {
	if err := decorateFollowNotifications(s.repo, userID, rows, outs); err != nil {
		return err
	}
	return s.decoratePostNotifications(rows, outs)
}

// chooseFollowBackIdentity 決定用哪個身份回追：只有一個候選就直接用；多個時必須指定 as。
func chooseFollowBackIdentity(plan *followBackPlan, as string) (*followBackCandidate, error) {
	if plan == nil || plan.State == storytellerModel.NotificationFollowBackUnavailable {
		return nil, ErrFollowBackUnavailable
	}
	as = strings.TrimSpace(as)
	if as == "" {
		if len(plan.Candidates) != 1 {
			return nil, ErrFollowBackIdentity
		}
		return &plan.Candidates[0], nil
	}
	for i := range plan.Candidates {
		if plan.Candidates[i].PenName == as {
			return &plan.Candidates[i], nil
		}
	}
	return nil, ErrFollowBackIdentity
}

// FollowBack 從通知回追：對方身份與可用的回追身份都由後端從通知內部鍵決定，前端只能在
// 作品多署名時用 as 指定其中一個筆名。已追蹤則冪等成功。
func (s *Service) FollowBack(userID uint64, notificationPublicID, as string) error {
	row, err := s.repo.Notification(userID, notificationPublicID)
	if err != nil {
		return err
	}
	plans, book, err := planFollowBacks(s.repo, userID, []storytellerModel.Notification{*row})
	if err != nil {
		return err
	}
	chosen, err := chooseFollowBackIdentity(plans[0], as)
	if err != nil {
		return err
	}
	_, err = s.createAuthorFavorite(userID, chosen.Key.ProfileID, book.resolved(plans[0].ActorKey))
	return err
}
