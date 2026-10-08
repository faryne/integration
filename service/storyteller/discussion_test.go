package storyteller

import (
	"strings"
	"testing"
	"time"

	storytellerModel "faryne.dev/model/entity/storyteller"
	"github.com/stretchr/testify/require"
)

func TestDiscussionAccessible(t *testing.T) {
	project := func(visibility storytellerModel.ProjectVisibility) *storytellerModel.Project {
		return &storytellerModel.Project{UserID: 1, Visibility: visibility, ShareToken: "tok"}
	}
	public, unlisted, private := project(storytellerModel.ProjectVisibilityPublic), project(storytellerModel.ProjectVisibilityUnlisted), project(storytellerModel.ProjectVisibilityPrivate)

	require.True(t, discussionAccessible(public, "", 0), "公開作品未登入也能看")
	require.False(t, discussionAccessible(unlisted, "", 2), "不公開作品沒帶分享 token 不能看")
	require.False(t, discussionAccessible(unlisted, "wrong", 2))
	require.True(t, discussionAccessible(unlisted, "tok", 0), "帶對的分享 token 就能看")
	require.True(t, discussionAccessible(unlisted, "", 1), "作者本人不用 token")
	require.False(t, discussionAccessible(private, "tok", 1), "私人作品連作者都沒有討論版")
}

func TestDiscussionSpeakerPick(t *testing.T) {
	speaker := &discussionSpeaker{State: storytellerModel.CommentViewerCanComment, Options: []followBackCandidate{
		{Key: storytellerModel.AuthorIdentityKey{UserID: 1, ProfileID: 7}, PenName: "霧島"},
		{Key: storytellerModel.AuthorIdentityKey{UserID: 1, ProfileID: 8}, PenName: "霧都"},
	}}
	key, err := speaker.pick("")
	require.NoError(t, err)
	require.Equal(t, uint64(7), key.ProfileID, "沒指定就用第一個（錨定那一話的署名排前面）")
	key, err = speaker.pick(" 霧都 ")
	require.NoError(t, err)
	require.Equal(t, uint64(8), key.ProfileID)
	_, err = speaker.pick("別人的筆名")
	require.ErrorIs(t, err, ErrDiscussionIdentity, "只能用這部作品署名過的身份")

	_, err = (&discussionSpeaker{State: storytellerModel.CommentViewerBlocked}).pick("")
	require.ErrorIs(t, err, ErrCommentBlocked)
	_, err = (&discussionSpeaker{State: storytellerModel.CommentViewerNeedPenName}).pick("")
	require.ErrorIs(t, err, ErrCommentPenNameRequired)
	require.Equal(t, []string{"霧島", "霧都"}, speaker.output().As)
}

func TestNormalizeDiscussionThread(t *testing.T) {
	title, body, err := normalizeDiscussionThread("  管家\n到底是不是   兇手？ ", "內文\r\n第二行")
	require.NoError(t, err)
	require.Equal(t, "管家 到底是不是 兇手？", title, "標題壓成單行")
	require.Equal(t, "內文\n第二行", body)

	_, _, err = normalizeDiscussionThread(" ", "內文")
	require.EqualError(t, err, "標題不能是空的")
	_, _, err = normalizeDiscussionThread("標題", strings.Repeat("字", storytellerModel.DiscussionBodyMaxRunes+1))
	require.ErrorAs(t, err, new(PostValidationError))
}

func TestBuildCommentThreadsDiscussionScope(t *testing.T) {
	edited := time.Now()
	rows := []storytellerModel.Comment{
		{ID: 1, PublicID: "c1", UserID: 2, Body: "讀者留言", EditedAt: &edited},
		{ID: 2, PublicID: "c2", UserID: 1, ProfileID: 8, ParentID: 1, Body: "作者用筆名霧都回覆"},
	}
	// 討論版：作品擁有者（帳號 1）的任一身份都算作者
	scope := commentScope{OwnerID: 1, IsAuthor: func(c *storytellerModel.Comment) bool { return c.UserID == 1 }, Editable: true}
	book := testIdentityBook()
	book.extras[8] = storytellerModel.AuthorProfile{ID: 8, UserID: 1, PenName: "霧都"}

	threads := buildCommentThreads(rows, book, scope, 2, nil)
	require.True(t, threads[0].Edited)
	require.True(t, threads[0].CanEdit, "讀者可以編輯自己的留言")
	require.False(t, threads[0].Replies[0].CanEdit, "不能編輯別人的留言")
	require.True(t, threads[0].Replies[0].IsPostAuthor)

	// 串鎖定或看的人被封鎖時（Editable=false）一律不能編輯
	scope.Editable = false
	require.False(t, buildCommentThreads(rows, book, scope, 2, nil)[0].CanEdit)
}
