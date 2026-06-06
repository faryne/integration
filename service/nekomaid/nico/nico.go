package nico

import (
	"encoding/json"
	"encoding/xml"
	"fmt"
	"html"
	"io"
	"net/http"
	"net/http/cookiejar"
	"net/url"
	"regexp"
	"strings"
	"sync"
	"time"

	"faryne.dev/config"
	"faryne.dev/model/entity/nekomaid"
	"faryne.dev/model/enum"
	nm "faryne.dev/service/nekomaid"
	"golang.org/x/net/publicsuffix"
)

type instance struct {
	SimpleBaseEndpoint string `json:"simple_base_endpoint"`
	DetailBaseEndpoint string `json:"detail_base_endpoint"`
	SourceBaseEndpoint string `json:"source_base_endpoint"`
	LoginEndpoint      string `json:"login_endpoint"`
	LoginFormEndpoint  string `json:"login_form_endpoint"`
	client             *http.Client
}

const loginCookieTTL = 30 * time.Minute

var (
	sharedCookieJar, _ = cookiejar.New(&cookiejar.Options{PublicSuffixList: publicsuffix.List})
	loginMu            sync.Mutex
	loggedInAt         time.Time
)

func New() nm.RetrieverInterface {
	return &instance{
		SimpleBaseEndpoint: "https://seiga.nicovideo.jp/api/illust/info",
		DetailBaseEndpoint: "https://sp.seiga.nicovideo.jp/ajax/seiga/%s",
		SourceBaseEndpoint: "https://seiga.nicovideo.jp/image/source/%s",
		LoginEndpoint:      "https://account.nicovideo.jp/login?site=seiga&next_url=%2F",
		LoginFormEndpoint:  "https://account.nicovideo.jp/login/redirector?site=seiga&next_url=%2F",
		client:             &http.Client{Jar: sharedCookieJar},
	}
}

type SimpleResponse struct {
	Image struct {
		Id           int64  `xml:"id"`
		UserId       int64  `xml:"user_id"`
		Title        string `xml:"title"`
		Description  string `xml:"description"`
		Summary      string `xml:"summary"`
		PublicStatus int64  `xml:"public_status"`
		AdultLevel   int64  `xml:"adult_level"`
	} `xml:"image"`
}

type DetailResponse struct {
	TargetImage struct {
		Id          string `json:"id"`
		UserId      string `json:"user_id"`
		Title       string `json:"title"`
		Description string `json:"description"`
		Nickname    string `json:"nickname"`
		ImageUrl    string `json:"image_url"`
		TagList     struct {
			Tag []struct {
				Name string `json:"name"`
			} `json:"tag"`
		} `json:"tag_list"`
	} `json:"target_image"`
}

func (i *instance) Login() error {
	loginMu.Lock()
	defer loginMu.Unlock()

	if !loggedInAt.IsZero() && time.Since(loggedInAt) < loginCookieTTL {
		return nil
	}
	cfg := config.EnvConfig()
	if cfg.NicoEmail == "" || cfg.NicoPassword == "" {
		return nil
	}

	loginFormEndpoint := i.LoginFormEndpoint
	loginPageReq, _ := http.NewRequest(http.MethodGet, i.LoginEndpoint, nil)
	loginPageReq.Header.Set("User-Agent", "Mozilla/5.0")
	loginPageResp, err := i.client.Do(loginPageReq)
	if err != nil {
		return err
	}
	loginPageBody, _ := io.ReadAll(loginPageResp.Body)
	loginPageResp.Body.Close()
	if loginPageResp.StatusCode >= 400 {
		return fmt.Errorf("nico login page failed: status=%d", loginPageResp.StatusCode)
	}
	if action := extractLoginFormAction(string(loginPageBody)); action != "" {
		loginFormEndpoint = action
	}

	form := url.Values{}
	form.Set("mail_tel", cfg.NicoEmail)
	form.Set("password", cfg.NicoPassword)

	req, _ := http.NewRequest(http.MethodPost, loginFormEndpoint, strings.NewReader(form.Encode()))
	req.Header.Set("Content-Type", "application/x-www-form-urlencoded")
	req.Header.Set("User-Agent", "Mozilla/5.0")
	req.Header.Set("Referer", i.LoginEndpoint)
	resp, err := i.client.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()
	if resp.StatusCode >= 400 {
		return fmt.Errorf("nico login failed: status=%d", resp.StatusCode)
	}
	loggedInAt = time.Now()
	return nil
}

func (i *instance) Get(id string) (*nekomaid.ArtworkMain, error) {
	if err := i.Login(); err != nil {
		return nil, err
	}
	numericId := strings.TrimPrefix(id, "im")

	// Step 1: Get Simple Info
	req1, _ := http.NewRequest(http.MethodGet, i.SimpleBaseEndpoint+"?id="+numericId, nil)
	resp1, err := i.client.Do(req1)
	if err != nil {
		return nil, err
	}
	defer resp1.Body.Close()
	var output1 SimpleResponse
	data1, _ := io.ReadAll(resp1.Body)
	xml.Unmarshal(data1, &output1)

	// Step 2: Get Detail Info
	req2, _ := http.NewRequest(http.MethodGet, fmt.Sprintf(i.DetailBaseEndpoint, "im"+numericId), nil)
	req2.Header.Set("Accept", "application/json, text/javascript, */*; q=0.01")
	req2.Header.Set("Referer", "https://sp.seiga.nicovideo.jp/seiga/im"+numericId)
	resp2, err := i.client.Do(req2)
	if err != nil {
		return nil, err
	}
	defer resp2.Body.Close()
	var output2 DetailResponse
	json.NewDecoder(resp2.Body).Decode(&output2)

	return i.parseGetArtwork(&output1, &output2, numericId)
}

func (i *instance) getImageResponse(client *http.Client, artworkId, fallbackImageUrl string) (*http.Response, error) {
	sourceUrl := fmt.Sprintf(i.SourceBaseEndpoint, strings.TrimPrefix(artworkId, "im"))
	req, _ := http.NewRequest(http.MethodGet, sourceUrl, nil)
	req.Header.Set("Referer", "https://seiga.nicovideo.jp/seiga/"+artworkId)
	req.Header.Set("User-Agent", "Mozilla/5.0")
	resp, err := client.Do(req)
	if err != nil {
		return nil, err
	}
	if resp.StatusCode >= 200 && resp.StatusCode < 300 && strings.HasPrefix(resp.Header.Get("Content-Type"), "image/") {
		return resp, nil
	}
	sourceBody, _ := io.ReadAll(resp.Body)
	resp.Body.Close()

	if imageUrl := extractSourceImageURL(string(sourceBody)); imageUrl != "" {
		req, _ = http.NewRequest(http.MethodGet, imageUrl, nil)
		req.Header.Set("Referer", sourceUrl)
		req.Header.Set("User-Agent", "Mozilla/5.0")
		return client.Do(req)
	}

	if fallbackImageUrl == "" {
		return nil, fmt.Errorf("nico source image response is not image: status=%d content_type=%s", resp.StatusCode, resp.Header.Get("Content-Type"))
	}

	req, _ = http.NewRequest(http.MethodGet, fallbackImageUrl, nil)
	req.Header.Set("Referer", "https://seiga.nicovideo.jp/seiga/"+artworkId)
	req.Header.Set("User-Agent", "Mozilla/5.0")
	return client.Do(req)
}

var nicoSourceImagePattern = regexp.MustCompile(`data-src=["']([^"']+)["']`)
var nicoLoginFormActionPattern = regexp.MustCompile(`<form[^>]+action=["']([^"']+)["'][^>]*id=["']login_form["']|<form[^>]+id=["']login_form["'][^>]+action=["']([^"']+)["']`)

func extractLoginFormAction(loginHTML string) string {
	match := nicoLoginFormActionPattern.FindStringSubmatch(loginHTML)
	if len(match) < 2 {
		return ""
	}
	action := match[1]
	if action == "" && len(match) >= 3 {
		action = match[2]
	}
	action = html.UnescapeString(strings.TrimSpace(action))
	if action == "" {
		return ""
	}
	switch {
	case strings.HasPrefix(action, "https://") || strings.HasPrefix(action, "http://"):
		return action
	case strings.HasPrefix(action, "/"):
		return "https://account.nicovideo.jp" + action
	default:
		return "https://account.nicovideo.jp/" + action
	}
}

func extractSourceImageURL(sourceHTML string) string {
	match := nicoSourceImagePattern.FindStringSubmatch(sourceHTML)
	if len(match) < 2 {
		return ""
	}
	rawURL := strings.TrimSpace(match[1])
	switch {
	case strings.HasPrefix(rawURL, "https://") || strings.HasPrefix(rawURL, "http://"):
		return rawURL
	case strings.HasPrefix(rawURL, "//"):
		return "https:" + rawURL
	case strings.HasPrefix(rawURL, "/"):
		return "https://lohas.nicoseiga.jp" + rawURL
	default:
		return rawURL
	}
}

func (i *instance) parseGetArtwork(simpleResponse *SimpleResponse, detailResponse *DetailResponse, numericId string) (*nekomaid.ArtworkMain, error) {
	artworkId := "im" + numericId
	if detailResponse.TargetImage.Id != "" {
		artworkId = "im" + strings.TrimPrefix(detailResponse.TargetImage.Id, "im")
	}
	title := simpleResponse.Image.Title
	if title == "" {
		title = detailResponse.TargetImage.Title
	}
	description := simpleResponse.Image.Description
	if description == "" {
		description = detailResponse.TargetImage.Description
	}

	var o = &nekomaid.ArtworkMain{
		Site:      "nico",
		AuthorId:  detailResponse.TargetImage.UserId,
		ArtworkId: artworkId,
		Title:     title,
		IsR18:     simpleResponse.Image.AdultLevel > 1,
		CreatedOn: time.Now(),
	}

	var tags []string
	for _, v := range detailResponse.TargetImage.TagList.Tag {
		tags = append(tags, v.Name)
	}

	resp, err := i.getImageResponse(i.client, o.ArtworkId, detailResponse.TargetImage.ImageUrl)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	img, thumb, err := nm.UploadImage(enum.NekomaidSiteNico, o.AuthorId, o.ArtworkId, resp, 0)
	if err != nil {
		return nil, err
	}

	o.FullContent = nekomaid.ArtworkMainFullContent{
		From:        enum.NekomaidSiteNico,
		AuthorId:    o.AuthorId,
		ArtworkId:   o.ArtworkId,
		IsR18:       map[bool]int{true: 1, false: 0}[o.IsR18],
		Title:       o.Title,
		Author:      detailResponse.TargetImage.Nickname,
		Photos:      []nekomaid.ArtworkPhoto{img},
		Tags:        tags,
		Thumb:       thumb,
		PreviewUrl:  fmt.Sprintf(nm.PreviewUrlPattern, enum.NekomaidSiteNico, o.AuthorId, o.ArtworkId),
		Description: description,
	}

	return o, nil
}
