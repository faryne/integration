package storyteller

import (
	"strings"
	"testing"
	"time"

	storytellerModel "faryne.dev/model/entity/storyteller"
	storytellerRepo "faryne.dev/repository/storyteller"
	"github.com/stretchr/testify/require"
)

func TestMaskSpoilersAndExcerpt(t *testing.T) {
	require.Equal(t, "反轉是［劇透］，還有［R18］", maskSpoilers("反轉是[spoiler]管家是兇手[/spoiler]，還有[r18]床戲[/r18]"))
	// 跨行內容也要遮；沒關閉的標記不算（前端同樣當一般文字顯示）
	require.Equal(t, "a［劇透］b [r18]沒關", maskSpoilers("a[spoiler]第一行\n第二行[/spoiler]b [r18]沒關"))
	// 不同種標記不能互相關閉
	require.Equal(t, "[spoiler]x[/r18]", maskSpoilers("[spoiler]x[/r18]"))

	// 摘要先遮再截：截斷位置落在標記中間也不會把內容露出來
	long := strings.Repeat("字", 75) + "[spoiler]這段很長的劇透內容不能出現在摘要裡[/spoiler]"
	excerpt := postExcerpt(long)
	require.NotContains(t, excerpt, "劇透內容")
	require.Equal(t, strings.Repeat("字", 75)+"［劇透］", excerpt)
	require.Equal(t, strings.Repeat("字", postExcerptRunes)+"…", postExcerpt(strings.Repeat("字", 100)))
	require.Equal(t, "第一行 第二行", postExcerpt("第一行\n\n第二行"))
}

func TestNormalizePostBody(t *testing.T) {
	body, err := normalizePostBody("  第一行\r\n第二行  ", "動態內容", 10)
	require.NoError(t, err)
	require.Equal(t, "第一行\n第二行", body)

	_, err = normalizePostBody(" \n ", "動態內容", 10)
	require.ErrorAs(t, err, new(PostValidationError))
	_, err = normalizePostBody(strings.Repeat("字", 11), "動態內容", 10)
	require.EqualError(t, err, "動態內容最多 10 字")
}

func TestCommentViewerState(t *testing.T) {
	post := storytellerModel.AuthorIdentityKey{UserID: 1, ProfileID: 7}
	cases := []struct {
		name       string
		viewer     uint64
		hasPenName bool
		blocked    bool
		key        storytellerModel.AuthorIdentityKey
		state      storytellerModel.CommentViewerState
	}{
		{"未登入", 0, false, false, storytellerModel.AuthorIdentityKey{}, storytellerModel.CommentViewerLoginRequired},
		// 在自己筆名 P 的貼文底下留言＝以 P 的身份，不需要本人有筆名
		{"作者本人用貼文身份", 1, false, false, post, storytellerModel.CommentViewerCanComment},
		{"被封鎖", 2, true, true, storytellerModel.AuthorIdentityKey{}, storytellerModel.CommentViewerBlocked},
		{"沒有筆名", 2, false, false, storytellerModel.AuthorIdentityKey{}, storytellerModel.CommentViewerNeedPenName},
		{"讀者用本人身份", 2, true, false, storytellerModel.AuthorIdentityKey{UserID: 2}, storytellerModel.CommentViewerCanComment},
	}
	for _, c := range cases {
		key, state := commentViewerState(c.viewer, post, c.hasPenName, c.blocked)
		require.Equal(t, c.key, key, c.name)
		require.Equal(t, c.state, state, c.name)
	}
}

func TestCommentRecipients(t *testing.T) {
	const owner, a, b, c = 1, 2, 3, 4
	kinds := func(recipients []commentRecipient) map[uint64]storytellerModel.NotificationKind {
		out := map[uint64]storytellerModel.NotificationKind{}
		for _, r := range recipients {
			out[r.UserID] = r.Kind
		}
		return out
	}
	top := &storytellerModel.Comment{ID: 10, UserID: a}
	ownerReply := &storytellerModel.Comment{ID: 11, UserID: owner, ParentID: 10}

	// 讀者頂層留言 → 只通知作者
	require.Equal(t, map[uint64]storytellerModel.NotificationKind{owner: storytellerModel.NotificationKindPostCommented},
		kinds(commentRecipients(owner, top, nil, nil)))
	// 作者自己頂層留言 → 沒人收到
	require.Empty(t, commentRecipients(owner, &storytellerModel.Comment{UserID: owner}, nil, nil))
	// 作者回覆 A 的留言 → A 收 replied，作者自己不收
	require.Equal(t, map[uint64]storytellerModel.NotificationKind{a: storytellerModel.NotificationKindPostReplied},
		kinds(commentRecipients(owner, ownerReply, top, nil)))
	// C 在 A 的串裡回覆 B → A、B 收 replied，作者收 commented
	bReply := &storytellerModel.Comment{ID: 12, UserID: b, ParentID: 10}
	require.Equal(t, map[uint64]storytellerModel.NotificationKind{
		a: storytellerModel.NotificationKindPostReplied, b: storytellerModel.NotificationKindPostReplied, owner: storytellerModel.NotificationKindPostCommented,
	}, kinds(commentRecipients(owner, &storytellerModel.Comment{UserID: c, ParentID: 10, ReplyToID: 12}, top, bReply)))
	// 被 @ 的是作者自己的回覆 → 作者只收一則 replied（不重複收 commented）
	recipients := commentRecipients(owner, &storytellerModel.Comment{UserID: b, ParentID: 10, ReplyToID: 11}, top, ownerReply)
	require.Len(t, recipients, 2)
	require.Equal(t, storytellerModel.NotificationKindPostReplied, kinds(recipients)[owner])
	require.Equal(t, ownerReply, recipients[0].OwnComment)
}

// testIdentityBook：帳號 1 本人「霧都」＋筆名 7「霧島」、帳號 2「白夜」、帳號 3 沒有筆名
func testIdentityBook() *identityBook {
	return &identityBook{
		users: map[uint64]storytellerModel.UserProfile{
			1: {ID: 1, PenName: "霧都"}, 2: {ID: 2, PenName: "白夜"}, 3: {ID: 3},
		},
		extras: map[uint64]storytellerModel.AuthorProfile{7: {ID: 7, UserID: 1, PenName: "霧島"}},
	}
}

func TestBuildCommentThreads(t *testing.T) {
	post := storytellerModel.AuthorIdentityKey{UserID: 1, ProfileID: 7}
	rows := []storytellerModel.Comment{
		{ID: 1, PublicID: "c1", UserID: 2, Body: "主留言"},
		{ID: 2, PublicID: "c1r1", UserID: 1, ProfileID: 7, ParentID: 1, Body: "作者回覆"},
		{ID: 3, PublicID: "c1r2", UserID: 3, ParentID: 1, ReplyToID: 2, Body: "沒筆名的人"},
		{ID: 4, PublicID: "c2", UserID: 2, IsDeleted: true, Body: "已刪除的內容"},
		{ID: 5, PublicID: "c2r1", UserID: 1, ProfileID: 7, ParentID: 4, ReplyToID: 4, Body: "回覆已刪除的"},
		{ID: 6, PublicID: "c1r3", UserID: 2, ParentID: 1, ReplyToID: 3, IsDeleted: true},
		{ID: 7, PublicID: "c1r4", UserID: 2, ParentID: 1, ReplyToID: 6, Body: "回覆被刪的回覆"},
	}

	// 作者本人看：可刪全部、可封鎖別人；被封鎖的人標 Blocked、不再出現封鎖按鈕
	scope := commentScope{OwnerID: post.UserID, IsAuthor: func(c *storytellerModel.Comment) bool { return c.Identity() == post }}
	threads := buildCommentThreads(rows, testIdentityBook(), scope, 1, map[uint64]bool{3: true})
	require.Len(t, threads, 2)
	require.Equal(t, "白夜", threads[0].Author.PenName)
	require.True(t, threads[0].CanDelete && threads[0].CanBlock)
	require.Len(t, threads[0].Replies, 4)
	authorReply := threads[0].Replies[0]
	require.True(t, authorReply.IsPostAuthor)
	require.Equal(t, "霧島", authorReply.Author.PenName)
	require.False(t, authorReply.CanBlock, "不能封鎖自己")
	noPen := threads[0].Replies[1]
	require.Nil(t, noPen.Author, "沒有筆名的身份不輸出名字（不能退回 email）")
	require.True(t, noPen.Blocked)
	require.False(t, noPen.CanBlock)
	require.Equal(t, &storytellerModel.CommentReplyToOutput{PublicID: "c1r1", PenName: "霧島"}, noPen.ReplyTo)
	// 刪除一律留佔位：不帶內文、身份、時間
	require.Equal(t, storytellerModel.CommentOutput{PublicID: "c1r3", Deleted: true}, threads[0].Replies[2])
	require.True(t, threads[0].Replies[3].ReplyTo.Deleted)
	require.True(t, threads[1].Deleted)
	require.Empty(t, threads[1].Body)
	require.Len(t, threads[1].Replies, 1)

	// 讀者白夜看：只能刪自己的，不能封鎖
	threads = buildCommentThreads(rows, testIdentityBook(), scope, 2, nil)
	require.True(t, threads[0].CanDelete)
	require.False(t, threads[0].CanBlock)
	require.False(t, threads[0].Replies[0].CanDelete)
	require.False(t, threads[0].Replies[1].Blocked, "封鎖狀態只給作者看")
}

func TestCommentNotificationInputs(t *testing.T) {
	post := &storytellerModel.AuthorPost{PublicID: "p1", UserID: 1, ProfileID: 7, Body: "第 12 話結尾 [spoiler]管家是兇手[/spoiler]"}
	comment := &storytellerModel.Comment{PublicID: "c9", UserID: 2, Body: "原來[spoiler]是他[/spoiler]！"}
	inputs := commentNotificationInputs(post, comment, nil, nil, testIdentityBook())
	require.Len(t, inputs, 1)
	payload := inputs[0].Payload
	require.Equal(t, uint64(1), inputs[0].UserID)
	require.Equal(t, "post.commented:c9", inputs[0].GroupKey)
	require.Equal(t, "白夜 留言了你的筆名 霧島 的貼文", payload.Title)
	require.Equal(t, "第 12 話結尾 ［劇透］", payload.PostExcerpt)
	require.Equal(t, "原來［劇透］！", payload.CommentExcerpt)
	require.Equal(t, uint64(7), payload.Internal.TargetProfileID)
	require.Equal(t, "c9", payload.ThreadPublicID, "頂層留言的串就是自己")

	// 作者以霧島回覆白夜 → 白夜收到「霧島 回覆了你的留言」，看不出霧島是誰
	reply := &storytellerModel.Comment{PublicID: "c10", UserID: 1, ProfileID: 7, ParentID: 9, Body: "對"}
	inputs = commentNotificationInputs(post, reply, &storytellerModel.Comment{ID: 9, UserID: 2, Body: "原來[r18]x[/r18]"}, nil, testIdentityBook())
	require.Len(t, inputs, 1)
	require.Equal(t, "霧島 回覆了你的留言", inputs[0].Payload.Title)
	require.Equal(t, "原來［R18］", inputs[0].Payload.ParentExcerpt)
	require.Equal(t, "", inputs[0].Payload.ThreadPublicID, "parent 沒有 public_id 時就是空的")
	require.Empty(t, inputs[0].Payload.TargetPenName)
}

func TestPostedNotification(t *testing.T) {
	key := storytellerModel.AuthorIdentityKey{UserID: 1, ProfileID: 7}
	// 台灣時間 10/8 23:59 與 10/9 00:01 是不同天（UTC 都還是 10/8）
	before := time.Date(2026, 10, 8, 15, 59, 0, 0, time.UTC)
	after := time.Date(2026, 10, 8, 16, 1, 0, 0, time.UTC)
	require.Equal(t, "author.posted:1:7:2026-10-08", postedGroupKey(key, before))
	require.Equal(t, "author.posted:1:7:2026-10-09", postedGroupKey(key, after))

	posts := []storytellerModel.AuthorPost{{ID: 1, PublicID: "p1", Body: "[r18]露骨[/r18]更新了"}, {ID: 2, PublicID: "p2", Body: "第二則"}}
	payload := postedNotificationPayload(key, posts, testIdentityBook(), map[uint64]string{1: "《霧都旅館》 第二卷・雨夜"})
	require.Equal(t, "霧島 發了 2 則新動態", payload.Title)
	require.Equal(t, "［R18］更新了", payload.Body)
	require.Equal(t, []storytellerModel.NotificationPost{{PublicID: "p1", Excerpt: "［R18］更新了", Work: "《霧都旅館》 第二卷・雨夜"}, {PublicID: "p2", Excerpt: "第二則"}}, payload.Posts)

	require.Equal(t, "《霧都旅館》", workLabel("霧都旅館", nil))
	require.Equal(t, "《霧都旅館》 第 13 話", workLabel("霧都旅館", &storytellerRepo.IdentityStoryRef{Title: "第 13 話"}))
}
