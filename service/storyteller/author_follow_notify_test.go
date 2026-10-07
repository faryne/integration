package storyteller

import (
	"testing"

	storytellerModel "faryne.dev/model/entity/storyteller"
	"github.com/stretchr/testify/require"
)

// 我（帳號 1）有本人身份「本名」與筆名 10「霧島」、11「夜行」；讀者 2「白夜」，讀者 3 沒設定筆名。
type fakeFollowRepo struct {
	favorites []storytellerModel.AuthorFavorite
	signing   map[uint64][]uint64
}

func ptrString(s string) *string { return &s }

func (f *fakeFollowRepo) UserProfilesByIDs(ids []uint64) (map[uint64]storytellerModel.UserProfile, error) {
	all := map[uint64]storytellerModel.UserProfile{
		1: {ID: 1, PenName: "本名"},
		2: {ID: 2, PenName: "白夜"},
		// 沒筆名的讀者：fallbackAuthorName 會退回 email，通知裡絕對不能出現
		3: {ID: 3, Email: ptrString("reader@example.com")},
	}
	out := map[uint64]storytellerModel.UserProfile{}
	for _, id := range ids {
		if row, ok := all[id]; ok {
			out[id] = row
		}
	}
	return out, nil
}

func (f *fakeFollowRepo) AuthorProfilesByIDs(ids []uint64) (map[uint64]storytellerModel.AuthorProfile, error) {
	all := map[uint64]storytellerModel.AuthorProfile{
		10: {ID: 10, UserID: 1, PenName: "霧島"},
		11: {ID: 11, UserID: 1, PenName: "夜行"},
		20: {ID: 20, UserID: 2, PenName: "白夜的筆名"},
	}
	out := map[uint64]storytellerModel.AuthorProfile{}
	for _, id := range ids {
		if row, ok := all[id]; ok {
			out[id] = row
		}
	}
	return out, nil
}

func (f *fakeFollowRepo) ActiveAuthorFavoritesTo(uint64, []uint64) ([]storytellerModel.AuthorFavorite, error) {
	return f.favorites, nil
}

func (f *fakeFollowRepo) ProjectSigningProfiles([]uint64) (map[uint64][]uint64, error) {
	return f.signing, nil
}

func followedRow(actorUser, actorProfile, target uint64) storytellerModel.Notification {
	return storytellerModel.Notification{
		Kind: storytellerModel.NotificationKindAuthorFollowed,
		Payload: storytellerModel.NotificationPayload{
			Title: "舊快照", TargetPenName: "舊筆名",
			Internal: &storytellerModel.NotificationInternal{ActorUserID: actorUser, ActorProfileID: actorProfile, TargetProfileID: target},
		},
	}
}

func decorate(t *testing.T, repo *fakeFollowRepo, rows ...storytellerModel.Notification) []storytellerModel.NotificationOutput {
	t.Helper()
	outs := make([]storytellerModel.NotificationOutput, len(rows))
	for i, row := range rows {
		outs[i] = storytellerModel.NotificationOutput{Kind: row.Kind, Payload: row.Payload}
		outs[i].Payload.Internal = nil
	}
	require.NoError(t, decorateFollowNotifications(repo, 1, rows, outs))
	return outs
}

func TestAuthorFollowedInputUsesPenNameAndHidesEmail(t *testing.T) {
	book, err := loadIdentityBook(&fakeFollowRepo{}, []storytellerModel.AuthorIdentityKey{{UserID: 2}, {UserID: 3}})
	require.NoError(t, err)
	target := &resolvedAuthorIdentity{UserID: 1, ProfileID: 10, Extra: &storytellerModel.AuthorProfile{ID: 10, UserID: 1, PenName: "霧島"}}

	input := authorFollowedInput(storytellerModel.AuthorIdentityKey{UserID: 2}, book, target)
	require.Equal(t, uint64(1), input.UserID)
	require.Equal(t, "白夜 追蹤了你的筆名 霧島", input.Payload.Title)
	require.Equal(t, "霧島", input.Payload.TargetPenName)
	require.Equal(t, "白夜", input.Payload.Actor.PenName)
	require.Empty(t, input.Payload.Actor.SNSLinks, "快照只留筆名與頭像")
	require.Equal(t, "author.followed:2:0:10", input.GroupKey)
	require.Equal(t, uint64(10), input.Payload.Internal.TargetProfileID)

	// 沒有筆名的讀者：顯示「一位讀者」，不帶 Actor，也不能出現 email
	self := &resolvedAuthorIdentity{UserID: 1, Self: &storytellerModel.UserProfile{ID: 1, PenName: "本名"}}
	anonymous := authorFollowedInput(storytellerModel.AuthorIdentityKey{UserID: 3}, book, self)
	require.Equal(t, "一位讀者 追蹤了你", anonymous.Payload.Title)
	require.Nil(t, anonymous.Payload.Actor)
	require.Empty(t, anonymous.Payload.TargetPenName)
	require.NotContains(t, anonymous.Payload.Title+anonymous.Payload.Body, "reader@example.com")
}

func TestProjectFavoritedInput(t *testing.T) {
	book, err := loadIdentityBook(&fakeFollowRepo{}, []storytellerModel.AuthorIdentityKey{{UserID: 2}})
	require.NoError(t, err)
	project := &storytellerModel.Project{ID: 5, PublicID: "p5", UserID: 1, Name: "霧都旅館"}
	input := projectFavoritedInput(2, book, project, []string{"霧島"})
	require.Equal(t, uint64(1), input.UserID)
	require.Equal(t, "白夜 收藏了你的作品《霧都旅館》", input.Payload.Title)
	require.Equal(t, "project.favorited:2:5", input.GroupKey)
	require.Equal(t, uint64(5), *input.ProjectID)
	require.Equal(t, []string{"霧島"}, input.Payload.Authors)
}

func TestDecorateFollowedNotification(t *testing.T) {
	repo := &fakeFollowRepo{}
	outs := decorate(t, repo, followedRow(2, 0, 10), followedRow(2, 0, 0))

	// 追蹤筆名：筆名改成目前的、回追身份只有被追蹤的那個筆名
	require.Equal(t, "霧島", outs[0].Payload.TargetPenName)
	require.Equal(t, "白夜", outs[0].Payload.Actor.PenName)
	require.Equal(t, storytellerModel.NotificationFollowBackNone, outs[0].FollowBack.State)
	require.Equal(t, []storytellerModel.NotificationFollowBackIdentity{{PenName: "霧島"}}, outs[0].FollowBack.Identities)

	// 追蹤本人：TargetPenName 清空，回追用本人
	require.Empty(t, outs[1].Payload.TargetPenName)
	require.Equal(t, []storytellerModel.NotificationFollowBackIdentity{{PenName: "本名", IsSelf: true}}, outs[1].FollowBack.Identities)
}

func TestDecorateFollowBackStates(t *testing.T) {
	// 我已經用霧島追蹤白夜；用本人追蹤白夜不算「以霧島回追」
	repo := &fakeFollowRepo{favorites: []storytellerModel.AuthorFavorite{
		{UserID: 1, FollowerProfileID: 10, AuthorUserID: 2},
		{UserID: 1, FollowerProfileID: 0, AuthorUserID: 2, AuthorProfileID: 20},
	}}
	outs := decorate(t, repo,
		followedRow(2, 0, 10),  // 已互相追蹤
		followedRow(2, 20, 11), // 白夜的筆名追蹤夜行：本人追蹤的是筆名 20，但夜行還沒回追
		followedRow(9, 0, 10),  // 對方帳號已不存在
		followedRow(2, 0, 99),  // 我被追蹤的筆名已刪除
	)
	require.Equal(t, storytellerModel.NotificationFollowBackFollowing, outs[0].FollowBack.State)
	require.Equal(t, storytellerModel.NotificationFollowBackNone, outs[1].FollowBack.State)
	require.Equal(t, storytellerModel.NotificationFollowBackUnavailable, outs[2].FollowBack.State)
	require.Nil(t, outs[2].Payload.Actor)
	require.Empty(t, outs[2].FollowBack.Identities)
	require.Equal(t, storytellerModel.NotificationFollowBackUnavailable, outs[3].FollowBack.State)
	require.Equal(t, "舊筆名", outs[3].Payload.TargetPenName, "筆名已刪除就保留快照")
}

func TestDecorateFavoritedUsesProjectSigningIdentities(t *testing.T) {
	projectID := uint64(5)
	repo := &fakeFollowRepo{signing: map[uint64][]uint64{5: {0, 11, 99}}}
	row := storytellerModel.Notification{
		Kind: storytellerModel.NotificationKindProjectFavorited, ProjectID: &projectID,
		Payload: storytellerModel.NotificationPayload{Internal: &storytellerModel.NotificationInternal{ActorUserID: 2}},
	}
	outs := decorate(t, repo, row)
	// 已刪除的筆名 99 不列；沒有署名過的霧島（10）也不會出現
	require.Equal(t, []storytellerModel.NotificationFollowBackIdentity{{PenName: "本名", IsSelf: true}, {PenName: "夜行"}}, outs[0].FollowBack.Identities)
	require.Equal(t, storytellerModel.NotificationFollowBackNone, outs[0].FollowBack.State)
}

func TestDecorateSkipsOtherKinds(t *testing.T) {
	row := storytellerModel.Notification{Kind: storytellerModel.NotificationKindStoryPublished}
	outs := decorate(t, &fakeFollowRepo{}, row)
	require.Nil(t, outs[0].FollowBack)
}

func TestChooseFollowBackIdentity(t *testing.T) {
	single := &followBackPlan{State: storytellerModel.NotificationFollowBackNone, Candidates: []followBackCandidate{{PenName: "霧島"}}}
	multi := &followBackPlan{State: storytellerModel.NotificationFollowBackNone, Candidates: []followBackCandidate{{PenName: "本名"}, {PenName: "夜行"}}}

	chosen, err := chooseFollowBackIdentity(single, "")
	require.NoError(t, err)
	require.Equal(t, "霧島", chosen.PenName)

	_, err = chooseFollowBackIdentity(multi, "")
	require.ErrorIs(t, err, ErrFollowBackIdentity)
	chosen, err = chooseFollowBackIdentity(multi, "夜行")
	require.NoError(t, err)
	require.Equal(t, "夜行", chosen.PenName)
	// 不能指定不在候選裡的筆名（例如沒署名過這部作品的霧島）
	_, err = chooseFollowBackIdentity(multi, "霧島")
	require.ErrorIs(t, err, ErrFollowBackIdentity)

	_, err = chooseFollowBackIdentity(&followBackPlan{State: storytellerModel.NotificationFollowBackUnavailable}, "")
	require.ErrorIs(t, err, ErrFollowBackUnavailable)
	_, err = chooseFollowBackIdentity(nil, "")
	require.ErrorIs(t, err, ErrFollowBackUnavailable)
}
