package av

import (
	"context"
	"errors"
	"fmt"
	"slices"
	"time"

	avEntity "faryne.dev/model/entity/opendata/av"
	"faryne.dev/model/enum"
	avRepo "faryne.dev/repository/av"
	"faryne.dev/service/client"
	"faryne.dev/service/log"
	"faryne.dev/service/recaptcha"

	"go.uber.org/zap"
)

// joyu.fyi 討論版：留言＋一層回覆，不能編輯、不能刪除（只有後台能刪）；匿名帳號每次都要過 reCAPTCHA，每則記錄 IP

const (
	commentPageSize = 20
	// commentPreviewReplies 列表裡每則頂層留言先帶幾則回覆（最新的），其餘點「顯示全部」再查
	commentPreviewReplies = 3
)

var (
	ErrCommentBanned      = errors.New("無法留言")
	ErrCommentRateLimited = errors.New("留言太頻繁，請稍後再試")
	ErrCommentRecaptcha   = errors.New("人機驗證失敗，請重新整理後再試")
	ErrCommentNotFound    = errors.New("找不到這則留言")
	ErrReportInvalid      = errors.New("檢舉原因不正確")
	ErrProfileAnonymous   = errors.New("匿名帳號不能修改暱稱，請先用 Google 登入")
)

// commentRateLimits 同一個 uid／IP 的留言頻率上限（Redis 固定視窗）
var commentRateLimits = []struct {
	key    string
	limit  int64
	window time.Duration
}{
	{"joyu:comment:uid:%s", 1, 20 * time.Second},
	{"joyu:comment:ip10m:%s", 10, 10 * time.Minute},
	{"joyu:comment:ipday:%s", 50, 24 * time.Hour},
}

// JoyuCommentPoster 送出留言的人（從 joyu ID token 與請求取得）
type JoyuCommentPoster struct {
	UID         string
	IsAnonymous bool
	IP          string
	Recaptcha   string
}

// ListJoyuComments 一頁頂層留言（新的在前），每則帶最新 3 則回覆
func ListJoyuComments(target string, page int) (*avEntity.JoyuCommentPage, error) {
	kind, key, err := parseCommentTarget(target)
	if err != nil {
		return nil, err
	}
	page = max(page, 1)
	repo := avRepo.NewJoyuComment()
	count, err := repo.CountByTarget(kind, key)
	if err != nil {
		return nil, err
	}
	tops, total, err := repo.TopLevel(kind, key, page, commentPageSize)
	if err != nil {
		return nil, err
	}
	ids := make([]uint64, 0, len(tops))
	for _, c := range tops {
		ids = append(ids, c.ID)
	}
	replies, err := repo.RepliesOf(ids)
	if err != nil {
		return nil, err
	}
	byParent := map[uint64][]avEntity.JoyuComment{}
	for _, r := range replies {
		byParent[r.ParentID] = append(byParent[r.ParentID], r)
	}
	users, err := commentUsers(append(slices.Clone(tops), replies...))
	if err != nil {
		return nil, err
	}
	out := &avEntity.JoyuCommentPage{Count: count, Total: total, Page: page, PerPage: commentPageSize, Data: make([]avEntity.JoyuCommentView, 0, len(tops))}
	for _, c := range tops {
		v := commentView(c, users)
		rs := byParent[c.ID]
		v.ReplyCount = len(rs)
		for _, r := range rs[max(len(rs)-commentPreviewReplies, 0):] {
			v.Replies = append(v.Replies, commentView(r, users))
		}
		out.Data = append(out.Data, v)
	}
	return out, nil
}

// JoyuCommentReplies 一則頂層留言的全部回覆（先舊後新）
func JoyuCommentReplies(id uint64) ([]avEntity.JoyuCommentView, error) {
	replies, err := avRepo.NewJoyuComment().RepliesOf([]uint64{id})
	if err != nil {
		return nil, err
	}
	users, err := commentUsers(replies)
	if err != nil {
		return nil, err
	}
	out := make([]avEntity.JoyuCommentView, 0, len(replies))
	for _, r := range replies {
		out = append(out, commentView(r, users))
	}
	return out, nil
}

// PostJoyuComment 送出留言或回覆；回覆別人的回覆時掛在同一則頂層留言下，記下對方（顯示 @暱稱）
func PostJoyuComment(ctx context.Context, p JoyuCommentPoster, req avEntity.JoyuCommentRequest) (*avEntity.JoyuCommentView, error) {
	kind, key, err := parseCommentTarget(req.Target)
	if err != nil {
		return nil, err
	}
	body, err := normalizeCommentBody(req.Body)
	if err != nil {
		return nil, err
	}
	if banned, err := avRepo.NewJoyuBan().IsBanned(p.UID, p.IP); err != nil {
		return nil, err
	} else if banned {
		return nil, ErrCommentBanned
	}
	if p.IsAnonymous {
		if err := recaptcha.Verify(ctx, p.Recaptcha, recaptcha.ActionJoyuComment, p.IP); err != nil {
			return nil, ErrCommentRecaptcha
		}
	}
	if !allowComment(p.UID, p.IP) {
		return nil, ErrCommentRateLimited
	}

	repo := avRepo.NewJoyuComment()
	now := time.Now()
	c := avEntity.JoyuComment{TargetType: kind, TargetKey: key, FirebaseUID: p.UID, IsAnonymous: p.IsAnonymous, Body: body, IP: p.IP, CreatedAt: &now}
	if req.ReplyTo > 0 {
		to, err := repo.Find(req.ReplyTo)
		if err != nil || to.TargetType != kind || to.TargetKey != key {
			return nil, ErrCommentNotFound
		}
		c.ParentID = to.ID
		if to.ParentID > 0 {
			c.ParentID, c.ReplyToUID = to.ParentID, to.FirebaseUID
		}
	}
	if err := repo.Create(&c); err != nil {
		return nil, err
	}
	users, err := commentUsers([]avEntity.JoyuComment{c})
	if err != nil {
		return nil, err
	}
	v := commentView(c, users)
	return &v, nil
}

// ReportJoyuComment 檢舉（同一人對同一則只算一次）
func ReportJoyuComment(uid, ip string, id uint64, reason string) error {
	if !slices.Contains(avEntity.CommentReportReasons, reason) {
		return ErrReportInvalid
	}
	repo := avRepo.NewJoyuComment()
	if _, err := repo.Find(id); err != nil {
		return ErrCommentNotFound
	}
	return repo.Report(id, uid, reason, ip)
}

// allowComment 依序檢查 uid／IP 的頻率限制；Redis 出錯時放行並記 log（匿名帳號還有 reCAPTCHA 擋著）
func allowComment(uid, ip string) bool {
	r := client.GetRedis(enum.RedisDefault)
	for _, l := range commentRateLimits {
		who := ip
		if l.key == commentRateLimits[0].key {
			who = uid
		}
		ok, err := client.AllowFixedWindow(r, fmt.Sprintf(l.key, who), l.limit, l.window)
		if err != nil {
			log.Logger().Warn("joyu comment: 頻率限制檢查失敗，放行", zap.Error(err))
			return true
		}
		if !ok {
			return false
		}
	}
	return true
}

// commentUsers 這些留言的留言者與被回覆者的站內資料
func commentUsers(rows []avEntity.JoyuComment) (map[string]avEntity.JoyuUser, error) {
	var uids []string
	for _, c := range rows {
		for _, uid := range []string{c.FirebaseUID, c.ReplyToUID} {
			if uid != "" && !slices.Contains(uids, uid) {
				uids = append(uids, uid)
			}
		}
	}
	return avRepo.NewJoyuUser().FindByUIDs(uids)
}

// commentView 公開的一則留言（不含 uid 與 IP）；被管理員刪除的不帶內容
func commentView(c avEntity.JoyuComment, users map[string]avEntity.JoyuUser) avEntity.JoyuCommentView {
	name, deleted := commentAuthorName(c.FirebaseUID, users)
	kind := "google"
	switch {
	case deleted:
		kind = "deleted"
	case c.IsAnonymous:
		kind = "anonymous"
	}
	v := avEntity.JoyuCommentView{ID: c.ID, Author: avEntity.JoyuCommentAuthor{Name: name, Kind: kind}, Deleted: c.IsDeleted, CreatedAt: c.CreatedAt}
	if !c.IsDeleted {
		v.Body = c.Body
	}
	if c.ReplyToUID != "" {
		to, _ := commentAuthorName(c.ReplyToUID, users)
		v.ReplyTo = &avEntity.JoyuCommentAuthor{Name: to}
	}
	return v
}

// JoyuProfileOf 個人資料頁：暱稱、目前顯示的名字、能不能改（匿名帳號不能）
func JoyuProfileOf(uid string, isAnonymous bool) (avEntity.JoyuProfile, error) {
	users, err := avRepo.NewJoyuUser().FindByUIDs([]string{uid})
	name, _ := commentAuthorName(uid, users)
	return avEntity.JoyuProfile{Nickname: users[uid].Nickname, DisplayName: name, CanEdit: !isAnonymous}, err
}

// SetJoyuNickname 改暱稱（只限 Google 帳號）
func SetJoyuNickname(uid string, isAnonymous bool, nickname string) error {
	if isAnonymous {
		return ErrProfileAnonymous
	}
	name, err := normalizeNickname(nickname)
	if err != nil {
		return err
	}
	return avRepo.NewJoyuUser().SetNickname(uid, name)
}
