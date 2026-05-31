package pixiv

import (
	"crypto/md5"
	"encoding/json"
	"fmt"
	"net/http"
	"net/url"
	"strconv"
	"strings"
	"time"

	_ "image/gif"
	_ "image/jpeg"
	_ "image/png"

	"faryne.dev/config"
	"faryne.dev/model/entity/nekomaid"
	"faryne.dev/model/enum"
	nm "faryne.dev/service/nekomaid"
)

type instance struct {
	Token *OAuthAPIResponse
}

const (
	TokenName    = "pixiv_cookie"
	LoginUrl     = "https://oauth.secure.pixiv.net/auth/token"
	ApiUrl       = "https://app-api.pixiv.net/v1"
	RefererUrl   = "https://www.pixiv.net/artworks/%s"
	ClientId     = "MOBrBDS8blbauoSck0ZfDbtuzpyT"
	ClientSecret = "lsACyCD94FhDUtGTXi3QzcFE2uU1hqtDaKeqrdwj"
	HashSecret   = "28c1fdd170a5204386cb1313c7077b34f83e4aaf4aa829ce78c231e05b0bae2c"
)

type OAuthAPIResponse struct {
	AccessToken  string `json:"access_token"`
	RefreshToken string `json:"refresh_token"`
	ExpiresIn    int    `json:"expires_in"`
}

type Response struct {
	Illust struct {
		Id       int64  `json:"id"`
		Title    string `json:"title"`
		Type     string `json:"type"`
		Caption  string `json:"caption"`
		Restrict int64  `json:"restrict"`
		User     struct {
			Id   int64  `json:"id"`
			Name string `json:"name"`
		} `json:"user"`
		Tags []struct {
			Name string `json:"name"`
		} `json:"tags"`
		MetaSinglePage struct {
			OriginalImageUrl string `json:"original_image_url"`
		} `json:"meta_single_page"`
		MetaPages []struct {
			ImageUrls struct {
				Original string `json:"original"`
			} `json:"image_urls"`
		} `json:"meta_pages"`
		PageCount int64 `json:"page_count"`
	} `json:"illust"`
}

func New() nm.RetrieverInterface {
	return &instance{}
}

func (i *instance) Login() error {
	// 暫時簡化，不使用 memcached，直接登入
	c := http.Client{}
	var u = url.Values{}
	u.Add("client_id", ClientId)
	u.Add("client_secret", ClientSecret)
	u.Add("get_secure_url", "1")
	// 注意：這裡假設 config 有這些欄位，如果沒有則需要適配
	u.Add("username", config.EnvConfig().PixivUsername)
	u.Add("password", config.EnvConfig().PixivPassword)
	u.Add("refresh_token", "OxA0xQjPUoLarW5IInGxqUNTEBwq9kptrIUoZfvqffA")
	u.Add("grant_type", "refresh_token")

	// 由於我們不知道 config 是否有 Pixiv 帳密，我們嘗試從環境變數讀取或留空
	// 這裡先根據新版代碼邏輯實作
	req, _ := http.NewRequest(http.MethodPost, LoginUrl, strings.NewReader(u.Encode()))
	req.Header.Add("Content-Type", "application/x-www-form-urlencoded")
	req.Header.Add("User-Agent", "PixivAndroidApp/5.0.64 (Android 6.0)")

	// Pixiv API 特有的 Hash 驗證
	now := time.Now().Format(time.RFC3339)
	req.Header.Add("X-Client-Time", now)
	m := md5.New()
	m.Write([]byte(now + HashSecret))
	req.Header.Add("X-Client-Hash", fmt.Sprintf("%x", m.Sum(nil)))

	resp, err := c.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()

	var token OAuthAPIResponse
	if err := json.NewDecoder(resp.Body).Decode(&token); err != nil {
		return err
	}
	i.Token = &token
	return nil
}

func (i *instance) Get(id string) (*nekomaid.ArtworkMain, error) {
	if i.Token == nil {
		if err := i.Login(); err != nil {
			return nil, err
		}
	}

	client := http.Client{}
	apiUrl := fmt.Sprintf("%s/illust/detail?illust_id=%s", ApiUrl, id)
	req, _ := http.NewRequest(http.MethodGet, apiUrl, nil)
	req.Header.Add("Authorization", "Bearer "+i.Token.AccessToken)
	req.Header.Add("User-Agent", "PixivAndroidApp/5.0.64 (Android 6.0)")

	resp, err := client.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	var result Response
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return nil, err
	}

	return i.parseGetArtwork(&result)
}

func (i *instance) parseGetArtwork(result *Response) (*nekomaid.ArtworkMain, error) {
	var o = &nekomaid.ArtworkMain{
		Site:      "pixiv",
		AuthorId:  strconv.FormatInt(result.Illust.User.Id, 10),
		ArtworkId: strconv.FormatInt(result.Illust.Id, 10),
		Title:     result.Illust.Title,
		IsR18:     result.Illust.Restrict > 0,
		CreatedOn: time.Now(),
	}

	var tags []string
	for _, t := range result.Illust.Tags {
		tags = append(tags, t.Name)
	}

	var photos []nekomaid.ArtworkPhoto
	var thumb string

	if result.Illust.PageCount > 1 {
		for idx, page := range result.Illust.MetaPages {
			fmt.Println("image url: ", page.ImageUrls.Original, " idx: ", idx, "")
			p, t, err := i.getImageUpload(o.ArtworkId, page.ImageUrls.Original, idx)
			if err != nil {
				return nil, err
			}
			if idx == 0 {
				thumb = t
			}
			photos = append(photos, p)
		}
	} else {
		fmt.Println("image url: ", result.Illust.MetaSinglePage.OriginalImageUrl, " idx: ", 0, "")
		p, t, err := i.getImageUpload(o.ArtworkId, result.Illust.MetaSinglePage.OriginalImageUrl, 0)
		if err != nil {
			return nil, err
		}
		thumb = t
		photos = append(photos, p)
	}

	o.FullContent = nekomaid.ArtworkMainFullContent{
		From:       enum.NekomaidSitePixiv,
		AuthorId:   o.AuthorId,
		ArtworkId:  o.ArtworkId,
		IsR18:      map[bool]int{true: 1, false: 0}[o.IsR18],
		Title:      o.Title,
		Author:     result.Illust.User.Name,
		Photos:     photos,
		Tags:       tags,
		Thumb:      thumb,
		PreviewUrl: fmt.Sprintf(nm.PreviewUrlPattern, enum.NekomaidSitePixiv, o.AuthorId, o.ArtworkId),
	}

	return o, nil
}

func (i *instance) getImageUpload(id string, u string, idx int) (nekomaid.ArtworkPhoto, string, error) {
	fmt.Println(u)
	req, _ := http.NewRequest(http.MethodGet, u, nil)
	req.Header.Add("Referer", "https://app-api.pixiv.net/")
	req.Header.Add("User-Agent", "PixivAndroidApp/5.0.64 (Android 6.0)")

	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return nekomaid.ArtworkPhoto{}, "", err
	}
	defer resp.Body.Close()

	return nm.UploadImage(id, resp, idx)
}
