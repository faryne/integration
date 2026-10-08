package sns

import (
	"fmt"
	"net/url"
	"regexp"
	"strconv"
	"strings"
	"unicode/utf8"

	modelSNS "faryne.dev/model/entity/sns"
	"faryne.dev/repository"
	"faryne.dev/service/log"
	"faryne.dev/service/storyteller"

	"go.uber.org/zap"
)

// SteamLoom 創作者頁的社群預覽：作者首頁（含收藏分頁）、動態列表、單則動態共用同一套格式——
// 標題「筆名 的作品／動態 | SteamLoom」、描述用自介（單則動態用貼文摘要）、圖用放大過的頭像配 summary 小卡；
// 單則動態附帶讀者看得到的作品時，改用該作品的 1200×630 圖卡。

const (
	// storytellerDescriptionMaxRunes 是作者自介當描述時的長度上限，平台卡片大約只顯示這麼多
	storytellerDescriptionMaxRunes = 150
	// storytellerAvatarShareSize 是頭像當預覽圖時跟頭像服務要的尺寸；登入頭像預設只有 96px，FB 低於 200px 會直接不出圖
	storytellerAvatarShareSize = 400
)

var (
	// 分組：1＝筆名、2＝posts、3＝貼文 public_id；收藏分頁跟作者首頁同一張卡
	storytellerUserPattern = regexp.MustCompile(`^/storyteller/user/([^/]+)(?:/(?:favorite-projects|favorite-authors)|/(posts)(?:/([^/]+))?)?$`)
	// googleAvatarOptionPattern 是 Google 帳號照片網址結尾的尺寸／裁切參數（例如 =s96-c）
	googleAvatarOptionPattern = regexp.MustCompile(`=[\w-]+$`)
)

// 測試時替換成假資料，不用真的連 DB
var (
	fetchStorytellerAuthorMeta = fetchStorytellerAuthorMetaFromService
	fetchStorytellerPostMeta   = fetchStorytellerPostMetaFromService
)

type storytellerAuthorMeta struct {
	PenName   string
	Bio       string
	AvatarURL string
}

type storytellerPostMeta struct {
	Author storytellerAuthorMeta
	// Excerpt 已遮蔽劇透／R18 標記
	Excerpt string
	// WorkPath 是附帶作品的閱讀頁路徑（含 /storyteller 前綴）；沒附、或發文身份已看不到該作品時為空
	WorkPath string
}

// applyStorytellerAuthorMeta 作者首頁、收藏分頁、動態列表、單則動態
func applyStorytellerAuthorMeta(meta *modelSNS.Meta, matches []string) {
	if postID := matches[3]; postID != "" {
		applyStorytellerPostMeta(meta, postID)
		return
	}
	penName, err := url.PathUnescape(matches[1])
	if err != nil {
		applyStorytellerNotFoundMeta(meta)
		return
	}
	author, err := fetchStorytellerAuthorMeta(penName)
	if err != nil {
		applyStorytellerCreatorFetchError(meta, err, zap.String("pen_name", penName))
		return
	}
	page := "作品"
	if matches[2] != "" {
		page = "動態"
	}
	applyStorytellerCreatorCard(meta, author, page)
}

// applyStorytellerPostMeta 單則動態只靠 post id 查（跟前端一致），網址上的筆名可能是改名前的舊筆名
func applyStorytellerPostMeta(meta *modelSNS.Meta, postID string) {
	post, err := fetchStorytellerPostMeta(postID)
	if err != nil {
		applyStorytellerCreatorFetchError(meta, err, zap.String("post", postID))
		return
	}
	applyStorytellerCreatorCard(meta, post.Author, "動態")
	if post.Excerpt != "" {
		meta.Description = post.Excerpt
	}
	meta.Type, meta.SchemaType, meta.AuthorName = "article", "SocialMediaPosting", post.Author.PenName
	// canonical 指回目前筆名的網址，舊筆名連結不會被當成另一頁收錄（absoluteURL 會負責 escape）
	canonical := absoluteURL(steamloomOrigin, "/user/"+post.Author.PenName+"/posts/"+postID)
	meta.Canonical, meta.OpenGraphURL, meta.RedirectURL = canonical, canonical, canonical
	// 附帶的作品讀者看得到、又不是限制級，就用那個作品的圖卡（跟分享作品本身同一張）
	if post.WorkPath == "" {
		return
	}
	target, _ := resolveStorytellerTarget(post.WorkPath)
	if target.NotFound || target.Err != nil || target.Project.Restricted {
		return
	}
	if source, ok := storytellerImage(target); ok {
		workCanonical := absoluteURL(steamloomOrigin, strings.TrimPrefix(post.WorkPath, storytellerPathPrefix))
		meta.Image = storytellerOGImageURL(workCanonical, source.version())
		meta.ImageWidth, meta.ImageHeight, meta.TwitterCard = storytellerOGImageWidth, storytellerOGImageHeight, ""
	}
}

// applyStorytellerCreatorCard 創作者頁共用的標題、描述與頭像；page 是「作品」或「動態」
func applyStorytellerCreatorCard(meta *modelSNS.Meta, author storytellerAuthorMeta, page string) {
	meta.Title = fullTitleForSite(fmt.Sprintf("%s 的%s", author.PenName, page), meta.SiteName)
	meta.Description = fmt.Sprintf("%s 在 SteamLoom 的%s。", author.PenName, page)
	if bio := truncateRunes(strings.Join(strings.Fields(author.Bio), " "), storytellerDescriptionMaxRunes); bio != "" {
		meta.Description = bio
	}
	meta.Type, meta.SchemaType = "profile", "ProfilePage"
	if author.AvatarURL != "" {
		// 頭像是方圖，用 summary 小卡；尺寸不一定（自訂網址），不填寬高讓平台自己判斷
		meta.Image, meta.ImageWidth, meta.ImageHeight = storytellerShareAvatarURL(author.AvatarURL), 0, 0
		meta.TwitterCard = "summary"
	}
}

// applyStorytellerCreatorFetchError 找不到就 404；暫時性錯誤維持品牌預設 meta，免得平台快取成「頁面不存在」
func applyStorytellerCreatorFetchError(meta *modelSNS.Meta, err error, field zap.Field) {
	if repository.IsRecordNotFound(err) {
		applyStorytellerNotFoundMeta(meta)
		return
	}
	log.Logger().Warn("SNS storyteller creator fetch failed", field, zap.Error(err))
}

// storytellerShareAvatarURL 把已知頭像服務（Google 登入照片、Gravatar）換成大尺寸版本；自訂頭像網址原樣使用
func storytellerShareAvatarURL(avatar string) string {
	parsed, err := url.Parse(avatar)
	if err != nil {
		return avatar
	}
	switch host := strings.ToLower(parsed.Host); {
	case strings.HasSuffix(host, ".googleusercontent.com"):
		return googleAvatarOptionPattern.ReplaceAllString(avatar, "") + fmt.Sprintf("=s%d-c", storytellerAvatarShareSize)
	case host == "gravatar.com" || strings.HasSuffix(host, ".gravatar.com"):
		query := parsed.Query()
		query.Set("s", strconv.Itoa(storytellerAvatarShareSize))
		parsed.RawQuery = query.Encode()
		return parsed.String()
	}
	return avatar
}

func fetchStorytellerAuthorMetaFromService(penName string) (storytellerAuthorMeta, error) {
	_, _, author, err := storyteller.NewService().PublicUserProjects(penName, 1, 1, 0)
	if err != nil {
		return storytellerAuthorMeta{}, err
	}
	return storytellerAuthorMeta{PenName: author.PenName, Bio: author.Bio, AvatarURL: author.AvatarURL}, nil
}

func fetchStorytellerPostMetaFromService(postID string) (storytellerPostMeta, error) {
	detail, err := storyteller.NewService().AuthorPostDetail(postID, 0)
	if err != nil {
		return storytellerPostMeta{}, err
	}
	post := detail.Post
	result := storytellerPostMeta{
		Author:  storytellerAuthorMeta{PenName: post.Author.PenName, Bio: post.Author.Bio, AvatarURL: post.Author.AvatarURL},
		Excerpt: storyteller.PostShareExcerpt(post.Body),
	}
	if work := post.Attachment; work != nil && !work.Unavailable && work.ProjectPublicID != "" {
		result.WorkPath = storytellerPathPrefix + "/work/" + work.ProjectPublicID
		if work.StoryPublicID != "" {
			result.WorkPath += "/story/" + work.StoryPublicID
		}
	}
	return result, nil
}

func truncateRunes(value string, limit int) string {
	if utf8.RuneCountInString(value) <= limit {
		return value
	}
	return string([]rune(value)[:limit]) + "…"
}
