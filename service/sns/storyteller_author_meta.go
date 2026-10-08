package sns

import (
	"fmt"
	"net/url"
	"regexp"
	"strings"
	"unicode/utf8"

	modelSNS "faryne.dev/model/entity/sns"
	"faryne.dev/repository"
	"faryne.dev/service/log"
	"faryne.dev/service/storyteller"

	"go.uber.org/zap"
)

// SteamLoom 創作者頁的社群預覽：作者首頁、動態列表、收藏分頁、單則動態共用同一套格式——
// 標題「筆名 的作品／的動態／追蹤的作品／追蹤的作家 | SteamLoom」（跟前端分頁名稱一致），
// 描述用自介（收藏分頁用固定句、單則動態用貼文摘要）。圖一律用 SteamLoom 品牌圖卡，不用頭像：
// 頭像多半小於平台的最低尺寸（FB 要 200×200），自訂頭像網址也不該讓後端去抓；
// 只有單則動態附帶讀者看得到的作品時，改用該作品的 1200×630 圖卡。

// storytellerDescriptionMaxRunes 是作者自介當描述時的長度上限，平台卡片大約只顯示這麼多
const storytellerDescriptionMaxRunes = 150

var (
	// 分組：1＝筆名、2＝分頁（posts／favorite-projects／favorite-authors）、3＝單則動態的 public_id
	storytellerUserPattern = regexp.MustCompile(`^/storyteller/user/([^/]+)(?:/(posts|favorite-projects|favorite-authors)|/posts/([^/]+))?$`)
	// storytellerCreatorTabPhrases 是各分頁接在筆名後面的文字，跟前端 helpers/steamloomCreatorSeo.ts 對應
	storytellerCreatorTabPhrases = map[string]string{
		"":                  "的作品",
		"posts":             "的動態",
		"favorite-projects": "追蹤的作品",
		"favorite-authors":  "追蹤的作家",
	}
)

// 測試時替換成假資料，不用真的連 DB
var (
	fetchStorytellerAuthorMeta = fetchStorytellerAuthorMetaFromService
	fetchStorytellerPostMeta   = fetchStorytellerPostMetaFromService
)

type storytellerAuthorMeta struct {
	PenName string
	Bio     string
	// ShowFavorites 只有本人身份的作者頁有收藏分頁；額外筆名的收藏網址前端會顯示作品分頁
	ShowFavorites bool
}

type storytellerPostMeta struct {
	Author storytellerAuthorMeta
	// Excerpt 已遮蔽劇透／R18 標記
	Excerpt string
	// WorkPath 是附帶作品的閱讀頁路徑（含 /storyteller 前綴）；沒附、或發文身份已看不到該作品時為空
	WorkPath string
}

// applyStorytellerAuthorMeta 作者首頁、動態列表、收藏分頁、單則動態
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
	tab := matches[2]
	// 沒有公開收藏的筆名，收藏網址在前端會落回作品分頁，canonical 也指回作者首頁
	if strings.HasPrefix(tab, "favorite-") && !author.ShowFavorites {
		tab = ""
		meta.Canonical = absoluteURL(steamloomOrigin, "/user/"+author.PenName)
		meta.OpenGraphURL, meta.RedirectURL = meta.Canonical, meta.Canonical
	}
	applyStorytellerCreatorCard(meta, author, tab)
}

// applyStorytellerPostMeta 單則動態只靠 post id 查（跟前端一致），網址上的筆名可能是改名前的舊筆名
func applyStorytellerPostMeta(meta *modelSNS.Meta, postID string) {
	post, err := fetchStorytellerPostMeta(postID)
	if err != nil {
		applyStorytellerCreatorFetchError(meta, err, zap.String("post", postID))
		return
	}
	applyStorytellerCreatorCard(meta, post.Author, "posts")
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
	}
}

// applyStorytellerCreatorCard 創作者頁共用的標題與描述；圖維持 BuildMeta 給的品牌圖卡
func applyStorytellerCreatorCard(meta *modelSNS.Meta, author storytellerAuthorMeta, tab string) {
	phrase := storytellerCreatorTabPhrases[tab]
	meta.Title = fullTitleForSite(author.PenName+" "+phrase, meta.SiteName)
	meta.Description = fmt.Sprintf("%s 在 SteamLoom %s。", author.PenName, phrase)
	// 收藏分頁講的是別人的作品，不拿自介當描述
	if bio := truncateRunes(strings.Join(strings.Fields(author.Bio), " "), storytellerDescriptionMaxRunes); bio != "" && !strings.HasPrefix(tab, "favorite-") {
		meta.Description = bio
	}
	meta.Type, meta.SchemaType = "profile", "ProfilePage"
}

// applyStorytellerCreatorFetchError 找不到就 404；暫時性錯誤維持品牌預設 meta，免得平台快取成「頁面不存在」
func applyStorytellerCreatorFetchError(meta *modelSNS.Meta, err error, field zap.Field) {
	if repository.IsRecordNotFound(err) {
		applyStorytellerNotFoundMeta(meta)
		return
	}
	log.Logger().Warn("SNS storyteller creator fetch failed", field, zap.Error(err))
}

func fetchStorytellerAuthorMetaFromService(penName string) (storytellerAuthorMeta, error) {
	_, _, author, err := storyteller.NewService().PublicUserProjects(penName, 1, 1, 0)
	if err != nil {
		return storytellerAuthorMeta{}, err
	}
	return storytellerAuthorMeta{PenName: author.PenName, Bio: author.Bio, ShowFavorites: author.ShowFavorites}, nil
}

func fetchStorytellerPostMetaFromService(postID string) (storytellerPostMeta, error) {
	detail, err := storyteller.NewService().AuthorPostDetail(postID, 0)
	if err != nil {
		return storytellerPostMeta{}, err
	}
	post := detail.Post
	result := storytellerPostMeta{
		Author:  storytellerAuthorMeta{PenName: post.Author.PenName, Bio: post.Author.Bio},
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
