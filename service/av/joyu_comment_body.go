package av

import (
	"crypto/sha1"
	"encoding/hex"
	"errors"
	"regexp"
	"strings"
	"unicode"
	"unicode/utf8"

	avEntity "faryne.dev/model/entity/opendata/av"
)

// 討論版的內容檢查、留言位置解析與顯示名稱

const (
	commentMaxRunes  = 2000
	nicknameMinRunes = 2
	nicknameMaxRunes = 20
)

var (
	ErrCommentInvalid = errors.New("留言的內容不正確")
	ErrCommentTooLong = errors.New("留言太長（最多 2000 字）")
	// ErrCommentHTML 前端本來就不會渲染 HTML 與圖片，後端再擋一次：直接擋下比默默吃掉好懂
	ErrCommentHTML     = errors.New("不支援 HTML 與圖片")
	ErrNicknameInvalid = errors.New("暱稱限 2～20 字，且不能使用保留字")
)

var (
	// htmlTagPattern 看起來像 HTML 標籤的（<b>、</div>、<!-- … 、<img src=…>）。`<` 後面要緊接字母、/ 或 !，
	// 瀏覽器本來就不會把「< b>」當成標籤，「a < b 而且 c > d」這種數學式才不會誤判
	htmlTagPattern = regexp.MustCompile(`(?i)</?[a-z!][^>]*>`)
	// markdownImagePattern Markdown 圖片語法 ![替代文字](網址)
	markdownImagePattern = regexp.MustCompile(`!\[[^\]]*\]\([^)]*\)`)
	// reservedNicknames 不能拿來當暱稱的（避免冒充匿名訪客、已刪除帳號或管理員）
	reservedNicknames = []string{"訪客", "已刪除", "管理員", "管理者", "joyu", "admin"}
)

// stripControl 去掉控制字元（換行與 tab 保留）
func stripControl(s string) string {
	return strings.Map(func(r rune) rune {
		if r == '\n' || r == '\t' || !unicode.IsControl(r) {
			return r
		}
		return -1
	}, s)
}

// normalizeCommentBody 留言內容：統一換行、去控制字元與頭尾空白；空的、太長的、含 HTML 或圖片語法的不收
func normalizeCommentBody(body string) (string, error) {
	body = strings.TrimSpace(stripControl(strings.ReplaceAll(body, "\r\n", "\n")))
	switch {
	case body == "":
		return "", ErrCommentInvalid
	case utf8.RuneCountInString(body) > commentMaxRunes:
		return "", ErrCommentTooLong
	case htmlTagPattern.MatchString(body), markdownImagePattern.MatchString(body):
		return "", ErrCommentHTML
	}
	return body, nil
}

// normalizeNickname 暱稱：去控制字元與頭尾空白，2～20 字，不能含保留字
func normalizeNickname(name string) (string, error) {
	name = strings.TrimSpace(strings.ReplaceAll(stripControl(name), "\n", " "))
	n := utf8.RuneCountInString(name)
	lower := strings.ToLower(name)
	if n < nicknameMinRunes || n > nicknameMaxRunes || strings.ContainsAny(name, "<>") {
		return "", ErrNicknameInvalid
	}
	for _, w := range reservedNicknames {
		if strings.Contains(lower, w) {
			return "", ErrNicknameInvalid
		}
	}
	return name, nil
}

// parseCommentTarget 「video:midv00900」或「actress:xcity:22105」→ 類型與正規化後的 key
func parseCommentTarget(target string) (string, string, error) {
	kind, key, _ := strings.Cut(strings.TrimSpace(target), ":")
	switch kind {
	case avEntity.CommentTargetVideo:
		if no := normalizeVideoNo(key); no != "" {
			return kind, no, nil
		}
	case avEntity.CommentTargetActress:
		if value, err := normalizeFollow(avEntity.FollowKindActress, key); err == nil {
			return kind, value, nil
		}
	}
	return "", "", ErrCommentInvalid
}

// guestName 沒有暱稱時的顯示名稱：「訪客-」加 uid 雜湊的前四碼，同一個人固定不變
func guestName(uid string) string {
	sum := sha1.Sum([]byte(uid))
	return "訪客-" + hex.EncodeToString(sum[:])[:4]
}

// commentAuthorName uid 對應的顯示名稱與類型（deleted／有暱稱的用暱稱／其他用訪客名）
func commentAuthorName(uid string, users map[string]avEntity.JoyuUser) (string, bool) {
	u, ok := users[uid]
	switch {
	case ok && u.IsDeleted:
		return "已刪除的帳號", true
	case ok && u.Nickname != "":
		return u.Nickname, false
	}
	return guestName(uid), false
}
