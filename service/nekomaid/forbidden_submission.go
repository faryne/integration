package nekomaid

import (
	"cmp"
	"crypto/hmac"
	"crypto/sha256"
	"encoding/hex"
	"errors"
	"fmt"
	"net/mail"
	"regexp"
	"strings"
	"time"
	"unicode/utf8"

	"faryne.dev/config"
	"faryne.dev/model/entity/nekomaid"
	"faryne.dev/model/enum"
	nekomaidRepo "faryne.dev/repository/nekomaid"
	authService "faryne.dev/service/auth"
	"faryne.dev/service/client"
)

const (
	// 版權申告每個 IP 每小時最多 5 件（從第一件起算的固定一小時）
	forbiddenSubmitIPKey    = "nekomaid:forbidden-submit:ip:%s"
	forbiddenSubmitIPLimit  = 5
	forbiddenSubmitIPWindow = time.Hour
	forbiddenMessageMaxLen  = 2000
)

// ErrForbiddenSubmitLimited 這個 IP 一小時內的申告次數用完，controller 據此回 429
var ErrForbiddenSubmitLimited = errors.New("artwork forbidden submission ip limit reached")

// SubmitForbidden 作品頁送出的版權申告；範圍最大到畫師（ArtworkId 留空＝整個畫師）。
// 不需登入，一律進待審；回傳送出者 IP 的 hash，申請人用 /copyright-claim/:hash 查自己（同一 IP）所有申告的處理結果
// （沒有寄信管道，這是唯一的回饋方式）。
func SubmitForbidden(req nekomaid.ForbiddenSubmitRequest, ip string) (*nekomaid.ForbiddenSubmitResult, error) {
	ipHash, err := hashSubmitterIP(ip)
	if err != nil {
		return nil, err
	}
	// honeypot 有值＝機器人：假裝成功、不寫入，避免對方知道被擋
	if strings.TrimSpace(req.Website) != "" {
		return &nekomaid.ForbiddenSubmitResult{Hash: ipHash, Status: nekomaid.SubmissionPending}, nil
	}
	row, err := normalizeForbiddenSubmit(req)
	if err != nil {
		return nil, err
	}
	// 已經被禁就不用再收（作品頁其實已經看不到，通常是舊分頁或直接打 API）
	if blocked, err := nekomaidRepo.NewForbiddenRepository().IsForbidden(row.Site, row.AuthorId, row.ArtworkId); err != nil {
		return nil, err
	} else if blocked {
		return nil, alreadyForbidden("這個畫師／作品已經停止收錄")
	}
	if err := acquireForbiddenSubmit(ip); err != nil {
		return nil, err
	}

	// 記錄送出者 IP：限流之外，後台也靠它辨認同一來源的大量惡意申告；公開查詢只用雜湊後的 ip_hash
	row.Status, row.Ip, row.IpHash = nekomaid.SubmissionPending, ip, ipHash
	if err := nekomaidRepo.NewForbiddenSubmissionRepository().Create(row); err != nil {
		return nil, err
	}
	return &nekomaid.ForbiddenSubmitResult{Hash: ipHash, Status: row.Status}, nil
}

// normalizeForbiddenSubmit 驗證並整理申告欄位（不碰 DB）；畫師 ID 必填，email 與說明都是選填，有填 email 才檢查格式
func normalizeForbiddenSubmit(req nekomaid.ForbiddenSubmitRequest) (*nekomaid.ArtworkForbiddenSubmission, error) {
	site, authorID, artworkID, err := normalizeForbiddenTarget(req.Site, req.AuthorId, req.ArtworkId)
	if err != nil {
		return nil, err
	}
	if authorID == "" {
		return nil, invalidForbidden("缺少畫師 ID")
	}
	email := strings.TrimSpace(req.ContactEmail)
	if addr, err := mail.ParseAddress(email); email != "" && (err != nil || addr.Address != email || len(email) > 255) {
		return nil, invalidForbidden("聯絡 email 格式不正確")
	}
	message := strings.TrimSpace(req.Message)
	if utf8.RuneCountInString(message) > forbiddenMessageMaxLen {
		return nil, invalidForbidden("申告說明最多 %d 字", forbiddenMessageMaxLen)
	}
	return &nekomaid.ArtworkForbiddenSubmission{Site: site, AuthorId: authorID, ArtworkId: artworkID, ContactEmail: email, Message: message}, nil
}

// ListPublicForbiddenSubmissions 公開的處理結果列表（/copyright-claim）；ipHash 有值時只列該 IP 送出的申告
// （/copyright-claim/:hash）。格式不對的 hash 直接回空列表，不透露任何資訊。
// 審核備註只在駁回時公開（核准時的備註是內部用）。
func ListPublicForbiddenSubmissions(input nekomaid.ForbiddenSubmissionPublicRequest, ipHash string) ([]nekomaid.ForbiddenSubmissionStatus, int64, error) {
	if ipHash != "" && !ipHashPattern.MatchString(ipHash) {
		return []nekomaid.ForbiddenSubmissionStatus{}, 0, nil
	}
	rows, total, err := nekomaidRepo.NewForbiddenSubmissionRepository().PublicSearch(input, ipHash)
	for i := range rows {
		if rows[i].Status != nekomaid.SubmissionRejected {
			rows[i].ReviewerNote = ""
		}
	}
	return rows, total, err
}

// SearchForbiddenSubmissions 後台審核列表
func SearchForbiddenSubmissions(userID uint64, input nekomaid.ForbiddenSubmissionSearchRequest) ([]nekomaid.ForbiddenSubmissionAdminItem, int64, error) {
	if err := authService.RequireAdmin(userID); err != nil {
		return nil, 0, err
	}
	return nekomaidRepo.NewForbiddenSubmissionRepository().Search(input)
}

// ApproveForbiddenSubmission 核准申告：寫進禁抓名單（由同步 job 開始把 ES 資料拉掉），再把申告標成已核准。
// 目標若已經被禁（例如同一畫師有人先申告過），視為已完成，照樣核准。
func ApproveForbiddenSubmission(userID, id uint64, note string) error {
	if err := authService.RequireAdmin(userID); err != nil {
		return err
	}
	repo := nekomaidRepo.NewForbiddenSubmissionRepository()
	submission, err := repo.FindPending(id)
	if err != nil {
		return err
	}
	note = strings.TrimSpace(note)
	_, err = addForbidden(nekomaid.ArtworkForbidden{
		Site: submission.Site, AuthorId: submission.AuthorId, ArtworkId: submission.ArtworkId,
		Source: nekomaid.ForbiddenSourceSubmission, SubmissionId: &submission.Id,
		Note: cmp.Or(note, fmt.Sprintf("版權申告 #%d", submission.Id)), CreatedBy: &userID,
	})
	if err != nil && !errors.Is(err, errAlreadyForbidden) {
		return err
	}
	return repo.Review(id, nekomaid.SubmissionApproved, note, userID)
}

// RejectForbiddenSubmission 駁回申告；理由必填，會顯示在申請人的查詢頁
func RejectForbiddenSubmission(userID, id uint64, note string) error {
	if err := authService.RequireAdmin(userID); err != nil {
		return err
	}
	if note = strings.TrimSpace(note); note == "" {
		return invalidForbidden("駁回需要填寫理由")
	}
	return nekomaidRepo.NewForbiddenSubmissionRepository().Review(id, nekomaid.SubmissionRejected, note, userID)
}

// acquireForbiddenSubmit IP 限流；沒有 IP（例如測試）或 Redis 異常時放行
func acquireForbiddenSubmit(ip string) error {
	r := client.GetRedis(enum.RedisDefault)
	if r == nil || ip == "" {
		return nil
	}
	key := fmt.Sprintf(forbiddenSubmitIPKey, ip)
	if n, err := r.Get(key).Int(); err == nil && n >= forbiddenSubmitIPLimit {
		return ErrForbiddenSubmitLimited
	}
	if count, err := r.Incr(key).Result(); err == nil && count == 1 {
		r.Expire(key, forbiddenSubmitIPWindow)
	}
	return nil
}

// ErrIPHashSecretMissing 沒設定 NEKOMAID_IP_HASH_SECRET；沒有鑰匙的 IP 雜湊可被暴力反推，所以直接拒收申告
var ErrIPHashSecretMissing = errors.New("NEKOMAID_IP_HASH_SECRET is not configured")

// ipHashPattern 公開查詢網址上的 hash 格式：HMAC-SHA256 的前 32 個 hex 字元
var ipHashPattern = regexp.MustCompile(`^[0-9a-f]{32}$`)

// hashSubmitterIP 用伺服器端鑰匙對 IP 做 HMAC-SHA256，取前 32 個 hex 字元（128 bits）當公開查詢用的 hash；
// 同一 IP 永遠得到同一個 hash，但沒有鑰匙就無法從 hash 反推 IP
func hashSubmitterIP(ip string) (string, error) {
	secret := config.EnvConfig().NekomaidIPHashSecret
	if secret == "" {
		return "", ErrIPHashSecretMissing
	}
	mac := hmac.New(sha256.New, []byte(secret))
	mac.Write([]byte(ip))
	return hex.EncodeToString(mac.Sum(nil))[:32], nil
}
