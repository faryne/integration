package sns

import (
	"errors"
	"image"
	"image/color"
	"strings"
	"testing"
	"time"

	modelSNS "faryne.dev/model/entity/sns"
	storytellerModel "faryne.dev/model/entity/storyteller"
	storytellerRepo "faryne.dev/repository/storyteller"
	"faryne.dev/service/storyteller"

	"gorm.io/gorm"
)

// stubStorytellerFetch 把 DB 查詢換成假資料；找不到的專案路徑／token 回 gorm.ErrRecordNotFound
func stubStorytellerFetch(t *testing.T, projects map[string]storytellerProjectMeta) {
	t.Helper()
	originalPublic, originalShared, originalAuthor, originalPage := fetchStorytellerPublicProjectMeta, fetchStorytellerSharedProjectMeta, fetchStorytellerAuthorMeta, storytellerFirstPageImage
	fetch := func(key string) (storytellerProjectMeta, error) {
		if key == "db-down" {
			return storytellerProjectMeta{}, errors.New("connection refused")
		}
		project, ok := projects[key]
		if !ok {
			return storytellerProjectMeta{}, gorm.ErrRecordNotFound
		}
		return project, nil
	}
	fetchStorytellerPublicProjectMeta, fetchStorytellerSharedProjectMeta = fetch, fetch
	fetchStorytellerAuthorMeta = func(penName string) (storytellerAuthorMeta, error) {
		switch penName {
		case "織夢者":
			return storytellerAuthorMeta{PenName: "織夢者", Bio: "寫蒸汽龐克的人。\n\n偶爾畫圖。", ShowFavorites: true}, nil
		case "副筆名":
			return storytellerAuthorMeta{PenName: "副筆名"}, nil
		}
		return storytellerAuthorMeta{}, gorm.ErrRecordNotFound
	}
	storytellerFirstPageImage = func(_ uint64, story storytellerModel.Story) (string, string, bool) {
		return "page-" + story.PublicID, "https://cdn.example.com/page.jpg", true
	}
	originalPost := fetchStorytellerPostMeta
	author := storytellerAuthorMeta{PenName: "織夢者"}
	fetchStorytellerPostMeta = func(postID string) (storytellerPostMeta, error) {
		posts := map[string]storytellerPostMeta{
			"p1": {Author: author, Excerpt: "新章上線［劇透］"},
			"p2": {Author: author, Excerpt: "第一話更新", WorkPath: "/storyteller/work/abc-x/story/s1"},
			"p3": {Author: author, Excerpt: "限制級更新", WorkPath: "/storyteller/work/r18-x"},
			"p4": {Author: author},
		}
		post, ok := posts[postID]
		if !ok {
			return storytellerPostMeta{}, gorm.ErrRecordNotFound
		}
		return post, nil
	}
	t.Cleanup(func() {
		fetchStorytellerPublicProjectMeta, fetchStorytellerSharedProjectMeta, fetchStorytellerAuthorMeta, storytellerFirstPageImage = originalPublic, originalShared, originalAuthor, originalPage
		fetchStorytellerPostMeta = originalPost
	})
}

func sampleStorytellerProject() storytellerProjectMeta {
	return storytellerProjectMeta{
		ID:           1,
		Title:        "河燈之城",
		Description:  "作品簡介",
		Author:       "織夢者",
		CoverAssetID: "cover1",
		CoverURL:     "https://cdn.example.com/cover.jpg",
		Focal:        storytellerModel.ProjectCoverFocalPoint{X: 0.5, Y: 0.32},
		Items: map[string]storytellerItemMeta{
			"story:s1": {Title: "第一話", Summary: "第一話摘要"},
			"story:i1": {Title: "第一頁漫畫", imageStory: &storytellerModel.Story{PublicID: "i1", ContentType: storytellerModel.ProjectContentTypeImage}},
			"lore:l1":  {Title: "白瀨澪", Summary: "第六席"},
		},
	}
}

func TestStorytellerMetaVisibilityAndItems(t *testing.T) {
	restricted := sampleStorytellerProject()
	restricted.Restricted = true
	stubStorytellerFetch(t, map[string]storytellerProjectMeta{"abc-x": sampleStorytellerProject(), "token": sampleStorytellerProject(), "r18-x": restricted})

	cases := []struct {
		path, title, description string
		status                   int
	}{
		{"storyteller/work/abc-x", "河燈之城 | SteamLoom", "作品簡介", 0},
		{"storyteller/work/abc-x/lores", "河燈之城 | SteamLoom", "作品簡介", 0},
		{"storyteller/work/abc-x/stories", "河燈之城 | SteamLoom", "作品簡介", 0},
		{"storyteller/work/abc-x/story/s1", "第一話 | 河燈之城 | SteamLoom", "第一話摘要", 0},
		{"storyteller/work/abc-x/story/s1/versions/9", "第一話 | 河燈之城 | SteamLoom", "第一話摘要", 0},
		{"storyteller/work/abc-x/lore/l1", "白瀨澪 | 河燈之城 | SteamLoom", "第六席", 0},
		{"storyteller/work/abc-x/s1", "第一話 | 河燈之城 | SteamLoom", "第一話摘要", 0},       // 舊網址：沒有種類前綴
		{"storyteller/work/abc-x/image/s1", "第一話 | 河燈之城 | SteamLoom", "第一話摘要", 0}, // 舊網址：image/
		{"storyteller/work/share/token/lore/l1", "白瀨澪 | 河燈之城 | SteamLoom", "第六席", 0},
		// 讀者看不到：私人／不存在的專案、草稿篇、未公開的設定、失效的分享連結 → 404
		{"storyteller/work/private-x", storytellerNotFoundTitle + " | SteamLoom", storytellerNotFoundDescription, 404},
		{"storyteller/work/private-x/story/s1", storytellerNotFoundTitle + " | SteamLoom", storytellerNotFoundDescription, 404},
		{"storyteller/work/abc-x/story/draft", storytellerNotFoundTitle + " | SteamLoom", storytellerNotFoundDescription, 404},
		{"storyteller/work/abc-x/lore/not-published", storytellerNotFoundTitle + " | SteamLoom", storytellerNotFoundDescription, 404},
		{"storyteller/work/share/expired", storytellerNotFoundTitle + " | SteamLoom", storytellerNotFoundDescription, 404},
		// 暫時性錯誤：退回品牌預設，不回 404
		{"storyteller/work/db-down", "SteamLoom", steamloomDescription, 0},
		// 限制級：標題保留，描述換成年齡提示
		{"storyteller/work/r18-x/story/s1", "第一話 | 河燈之城 | SteamLoom", storytellerRestrictedDescription, 0},
	}
	for _, c := range cases {
		meta := BuildMeta(modelSNS.RenderRequest{Path: c.path, Host: "steamloom.works"})
		if meta.Title != c.title || meta.Description != c.description || meta.Status != c.status {
			t.Errorf("%s: got (%q, %q, %d), want (%q, %q, %d)", c.path, meta.Title, meta.Description, meta.Status, c.title, c.description, c.status)
		}
		if c.status == 404 && meta.Robots != "noindex, nofollow" {
			t.Errorf("%s: 404 page should be noindex, got %q", c.path, meta.Robots)
		}
	}
}

func TestStorytellerMetaImages(t *testing.T) {
	restricted := sampleStorytellerProject()
	restricted.Restricted = true
	noCover := sampleStorytellerProject()
	noCover.CoverURL, noCover.CoverAssetID = "", ""
	stubStorytellerFetch(t, map[string]storytellerProjectMeta{"abc-x": sampleStorytellerProject(), "r18-x": restricted, "plain-x": noCover})

	// 文字故事用專案封面，圖卡網址跟閱讀頁一一對應
	meta := BuildMeta(modelSNS.RenderRequest{Path: "storyteller/work/abc-x/story/s1", Host: "steamloom.works"})
	if !strings.HasPrefix(meta.Image, "https://steamloom.works/og-image/work/abc-x/story/s1.jpg?v=") {
		t.Fatalf("unexpected og:image: %s", meta.Image)
	}
	if meta.ImageWidth != 1200 || meta.ImageHeight != 630 {
		t.Fatalf("unexpected image size: %dx%d", meta.ImageWidth, meta.ImageHeight)
	}
	// 圖像話用第一頁，版本跟封面不同
	imageMeta := BuildMeta(modelSNS.RenderRequest{Path: "storyteller/work/abc-x/story/i1", Host: "steamloom.works"})
	if strings.Split(imageMeta.Image, "?v=")[1] == strings.Split(meta.Image, "?v=")[1] {
		t.Fatalf("image episode should use its first page, got same version as cover")
	}
	// 限制級與沒封面都用品牌預設圖
	for _, path := range []string{"storyteller/work/r18-x/story/s1", "storyteller/work/plain-x"} {
		meta := BuildMeta(modelSNS.RenderRequest{Path: path, Host: "steamloom.works"})
		if meta.Image != steamloomOrigin+steamloomDefaultImagePath {
			t.Errorf("%s: expected brand default image, got %s", path, meta.Image)
		}
	}
}

func TestStorytellerMetaCanonicalUsesSteamLoomEvenOnFaryneDev(t *testing.T) {
	stubStorytellerFetch(t, map[string]storytellerProjectMeta{"abc-x": sampleStorytellerProject()})

	meta := BuildMeta(modelSNS.RenderRequest{Path: "storyteller/work/abc-x/story/s1"})
	if meta.Canonical != "https://steamloom.works/work/abc-x/story/s1" {
		t.Fatalf("unexpected canonical: %s", meta.Canonical)
	}
	if meta.OpenGraphURL != meta.Canonical {
		t.Fatalf("og:url should equal canonical on SteamLoom, got %s", meta.OpenGraphURL)
	}
	if meta.SiteURL != steamloomOrigin || meta.SchemaType != "CreativeWork" || meta.AuthorName != "織夢者" {
		t.Fatalf("unexpected JSON-LD fields: %+v", meta)
	}
}

func TestStorytellerAuthorMeta(t *testing.T) {
	stubStorytellerFetch(t, nil)
	const user = "storyteller/user/%E7%B9%94%E5%A4%A2%E8%80%85"
	bio, brand := "寫蒸汽龐克的人。 偶爾畫圖。", "https://steamloom.works/steamloom-og-default.jpg"

	cases := []struct{ path, title, description, canonical string }{
		{user, "織夢者 的作品 | SteamLoom", bio, ""},
		{user + "/posts", "織夢者 的動態 | SteamLoom", bio, ""},
		{user + "/favorite-projects", "織夢者 追蹤的作品 | SteamLoom", "織夢者 在 SteamLoom 追蹤的作品。", ""},
		{user + "/favorite-authors", "織夢者 追蹤的作家 | SteamLoom", "織夢者 在 SteamLoom 追蹤的作家。", ""},
		// 額外筆名沒有公開收藏：前端落回作品分頁，canonical 指回作者首頁
		{"storyteller/user/%E5%89%AF%E7%AD%86%E5%90%8D/favorite-projects", "副筆名 的作品 | SteamLoom", "副筆名 在 SteamLoom 的作品。", "https://steamloom.works/user/%E5%89%AF%E7%AD%86%E5%90%8D"},
	}
	for _, tc := range cases {
		meta := BuildMeta(modelSNS.RenderRequest{Path: tc.path, Host: "steamloom.works"})
		if meta.Title != tc.title || meta.Description != tc.description || meta.Image != brand || meta.ImageWidth != 1200 || meta.SchemaType != "ProfilePage" {
			t.Fatalf("%s: unexpected author meta: %+v", tc.path, meta)
		}
		if tc.canonical != "" && meta.Canonical != tc.canonical {
			t.Fatalf("%s: unexpected canonical %s", tc.path, meta.Canonical)
		}
	}
	for _, path := range []string{"storyteller/user/nobody", "storyteller/user/nobody/posts", "storyteller/user/x/posts/missing"} {
		if missing := BuildMeta(modelSNS.RenderRequest{Path: path, Host: "steamloom.works"}); missing.Status != 404 {
			t.Fatalf("%s should be 404, got %d", path, missing.Status)
		}
	}
}

func TestStorytellerAuthorPostMeta(t *testing.T) {
	restricted := sampleStorytellerProject()
	restricted.Restricted = true
	stubStorytellerFetch(t, map[string]storytellerProjectMeta{"abc-x": sampleStorytellerProject(), "r18-x": restricted})
	brand := "https://steamloom.works/steamloom-og-default.jpg"

	// 網址上是舊筆名：canonical 換成目前的筆名
	meta := BuildMeta(modelSNS.RenderRequest{Path: "storyteller/user/old-name/posts/p1", Host: "steamloom.works"})
	if meta.Title != "織夢者 的動態 | SteamLoom" || meta.Description != "新章上線［劇透］" || meta.Image != brand ||
		meta.Canonical != "https://steamloom.works/user/%E7%B9%94%E5%A4%A2%E8%80%85/posts/p1" || meta.OpenGraphURL != meta.Canonical ||
		meta.SchemaType != "SocialMediaPosting" || meta.AuthorName != "織夢者" {
		t.Fatalf("unexpected post meta: %+v", meta)
	}
	// 附作品：用作品的 1200×630 圖卡
	withWork := BuildMeta(modelSNS.RenderRequest{Path: "storyteller/user/x/posts/p2", Host: "steamloom.works"})
	if !strings.HasPrefix(withWork.Image, "https://steamloom.works/og-image/work/abc-x/story/s1.jpg?v=") || withWork.ImageWidth != 1200 {
		t.Fatalf("post with work should use work card: %+v", withWork)
	}
	// 限制級作品不出封面；沒有內文就用預設描述
	if r18 := BuildMeta(modelSNS.RenderRequest{Path: "storyteller/user/x/posts/p3", Host: "steamloom.works"}); r18.Image != brand {
		t.Fatalf("restricted work should fall back to brand image: %+v", r18)
	}
	if empty := BuildMeta(modelSNS.RenderRequest{Path: "storyteller/user/x/posts/p4", Host: "steamloom.works"}); empty.Description != "織夢者 在 SteamLoom 的動態。" {
		t.Fatalf("unexpected fallback description: %q", empty.Description)
	}
}

func TestStorytellerRenderHTMLStatusAndJSONLD(t *testing.T) {
	stubStorytellerFetch(t, map[string]storytellerProjectMeta{"abc-x": sampleStorytellerProject()})

	html, status, err := RenderHTML(modelSNS.RenderRequest{Path: "storyteller/work/abc-x/story/s1", Host: "steamloom.works"})
	if err != nil || status != 200 {
		t.Fatalf("unexpected render result: %d %v", status, err)
	}
	for _, want := range []string{`"@type":"CreativeWork"`, `"url":"https://steamloom.works"`, `og:image:width" content="1200"`, `"author":{"@type":"Person","name":"織夢者"}`} {
		if !strings.Contains(html, want) {
			t.Errorf("html should contain %s:\n%s", want, html)
		}
	}
	if _, status, _ := RenderHTML(modelSNS.RenderRequest{Path: "storyteller/work/missing", Host: "steamloom.works"}); status != 404 {
		t.Fatalf("missing project should render 404, got %d", status)
	}
}

func TestStorytellerProjectMetaMasksSpoilerLoreAndSkipsVolumes(t *testing.T) {
	meta := storytellerProjectMetaFromOutput(&storytellerModel.ProjectOutput{
		Project: storytellerModel.Project{Name: "河燈之城", Rating: storytellerModel.ProjectRatingRestricted},
		Stories: []storytellerModel.Story{{PublicID: "v1", Title: "第一冊", IsVolume: true}},
		Lores: []storytellerModel.Lore{
			{PublicID: "l1", Title: "白瀨澪", Summary: "第六席"},
			{PublicID: "l2", Title: "第零席的真名", Summary: "其實是……", IsSpoiler: true},
		},
	})
	if got := meta.Items["lore:l1"]; got.Title != "白瀨澪" || got.Summary != "第六席" {
		t.Fatalf("unexpected normal lore meta: %+v", got)
	}
	if got := meta.Items["lore:l2"]; got.Title != storytellerSpoilerLoreTitle || got.Summary != "" {
		t.Fatalf("spoiler lore leaked: %+v", got)
	}
	if _, ok := meta.Items["story:v1"]; ok {
		t.Fatalf("volume should not be a shareable item")
	}
	if !meta.Restricted {
		t.Fatalf("restricted rating should be carried over")
	}
}

func TestStorytellerOGImageEndpoint(t *testing.T) {
	restricted := sampleStorytellerProject()
	restricted.Restricted = true
	stubStorytellerFetch(t, map[string]storytellerProjectMeta{"abc-x": sampleStorytellerProject(), "r18-x": restricted})
	originalFetchSource := fetchOGImageSource
	fetchOGImageSource = func(string) ([]byte, error) { return nil, errors.New("s3 down") }
	t.Cleanup(func() { fetchOGImageSource = originalFetchSource })

	if got := StorytellerOGImage("storyteller/work/missing.jpg"); got.Status != 404 {
		t.Fatalf("missing project should 404, got %d", got.Status)
	}
	if got := StorytellerOGImage("storyteller/work/abc-x/story/draft.jpg"); got.Status != 404 {
		t.Fatalf("draft story should 404, got %d", got.Status)
	}
	for _, path := range []string{"storyteller/work/r18-x.jpg", "storyteller/work/abc-x/story/s1.jpg"} {
		// 限制級、原圖抓不到都退回品牌預設圖
		if got := StorytellerOGImage(path); got.Status != 302 || got.RedirectURL != steamloomOrigin+steamloomDefaultImagePath {
			t.Errorf("%s: expected redirect to default image, got %+v", path, got)
		}
	}
}

func TestComposeOGCanvas(t *testing.T) {
	focal := storytellerModel.ProjectCoverFocalPoint{X: 0.9, Y: 0.5}
	for _, size := range [][2]int{{600, 900}, {2000, 800}, {500, 500}} {
		src := image.NewRGBA(image.Rect(0, 0, size[0], size[1]))
		src.Set(0, 0, color.White)
		got := composeOGCanvas(src, focal).Bounds()
		if got.Dx() != 1200 || got.Dy() != 630 {
			t.Errorf("%v: canvas should be 1200x630, got %dx%d", size, got.Dx(), got.Dy())
		}
	}
	// 焦點靠右時裁切範圍要往右，但不能超出原圖
	crop := focalCropRect(4000, 1000, 1200.0/630.0, focal)
	if crop.Max.X != 4000 || crop.Dy() != 1000 {
		t.Fatalf("unexpected focal crop: %v", crop)
	}
}

func TestBuildSteamLoomSitemap(t *testing.T) {
	updated := time.Date(2026, 10, 7, 12, 0, 0, 0, time.UTC)
	body, err := buildSteamLoomSitemap(&storyteller.SitemapData{
		Projects: []storytellerModel.Project{{PublicID: "abc", Slug: "river", UpdatedAt: updated}},
		Stories:  []storytellerRepo.SitemapItem{{ProjectPublicID: "abc", ProjectSlug: "river", ItemPublicID: "s1", UpdatedAt: updated}},
		Lores:    []storytellerRepo.SitemapItem{{ProjectPublicID: "abc", ProjectSlug: "river", ItemPublicID: "l1", UpdatedAt: updated}},
		PenNames: []string{"織夢者"},
	})
	if err != nil {
		t.Fatal(err)
	}
	for _, want := range []string{
		"<loc>https://steamloom.works/</loc>",
		"<loc>https://steamloom.works/work/abc-river</loc>",
		"<loc>https://steamloom.works/work/abc-river/story/s1</loc>",
		"<loc>https://steamloom.works/work/abc-river/lore/l1</loc>",
		"<loc>https://steamloom.works/user/%E7%B9%94%E5%A4%A2%E8%80%85</loc>",
		"<lastmod>2026-10-07</lastmod>",
	} {
		if !strings.Contains(body, want) {
			t.Errorf("sitemap should contain %s:\n%s", want, body)
		}
	}
	if !strings.Contains(SteamLoomRobotsTxt(), "Sitemap: https://steamloom.works/sitemap.xml") {
		t.Fatalf("robots.txt should point to SteamLoom sitemap")
	}
}
