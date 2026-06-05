package pixiv

import (
	"archive/zip"
	"bytes"
	"crypto/md5"
	"encoding/json"
	"fmt"
	"image"
	"io"
	"net/http"
	"net/url"
	"os"
	"os/exec"
	"path/filepath"
	"strconv"
	"strings"
	"time"

	_ "image/jpeg"
	_ "image/png"

	"faryne.dev/config"
	"faryne.dev/model/entity/nekomaid"
	"faryne.dev/model/enum"
	"faryne.dev/service/client"
	nm "faryne.dev/service/nekomaid"
)

type instance struct {
	Token *OAuthAPIResponse
}

const (
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

type UgoiraMetadataResponse struct {
	UgoiraMetadata struct {
		ZipUrls struct {
			Medium string `json:"medium"`
		} `json:"zip_urls"`
		Frames []ugoiraFrame `json:"frames"`
	} `json:"ugoira_metadata"`
}

type ugoiraFrame struct {
	File  string `json:"file"`
	Delay int    `json:"delay"`
}

func New() nm.RetrieverInterface {
	return &instance{}
}

func (i *instance) Login() error {
	if token, ok := getCachedToken(); ok {
		i.Token = token
		return nil
	}

	c := http.Client{}
	var u = url.Values{}
	u.Add("client_id", ClientId)
	u.Add("client_secret", ClientSecret)
	u.Add("get_secure_url", "1")
	u.Add("username", config.EnvConfig().PixivUsername)
	u.Add("password", config.EnvConfig().PixivPassword)
	u.Add("refresh_token", "OxA0xQjPUoLarW5IInGxqUNTEBwq9kptrIUoZfvqffA")
	u.Add("grant_type", "refresh_token")

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
	cacheToken(&token)
	return nil
}

func getCachedToken() (*OAuthAPIResponse, bool) {
	r := client.GetRedis(enum.RedisDefault)
	if r == nil {
		return nil, false
	}

	raw, err := r.Get(string(enum.NekomaidRedisKeyPixivToken)).Result()
	if err != nil {
		return nil, false
	}

	var token OAuthAPIResponse
	if err := json.Unmarshal([]byte(raw), &token); err != nil {
		_ = r.Del(string(enum.NekomaidRedisKeyPixivToken)).Err()
		return nil, false
	}
	if token.AccessToken == "" {
		_ = r.Del(string(enum.NekomaidRedisKeyPixivToken)).Err()
		return nil, false
	}
	return &token, true
}

func cacheToken(token *OAuthAPIResponse) {
	r := client.GetRedis(enum.RedisDefault)
	if r == nil || token == nil {
		return
	}

	data, err := json.Marshal(token)
	if err != nil {
		return
	}

	expiration := time.Duration(token.ExpiresIn) * time.Second
	if expiration > time.Minute {
		expiration -= time.Minute
	}
	_ = r.Set(string(enum.NekomaidRedisKeyPixivToken), string(data), expiration).Err()
}

func (i *instance) Get(id string) (*nekomaid.ArtworkMain, error) {
	result, err := i.getArtworkDetail(id)
	if err != nil {
		return nil, err
	}

	return i.parseGetArtwork(result)
}

func (i *instance) GetPreview(id string) (string, bool, error) {
	result, err := i.getArtworkDetail(id)
	if err != nil {
		return "", false, err
	}

	authorId := strconv.FormatInt(result.Illust.User.Id, 10)
	artworkId := strconv.FormatInt(result.Illust.Id, 10)
	previewURL := fmt.Sprintf(nm.PreviewUrlPattern, enum.NekomaidSitePixiv, authorId, artworkId)
	return previewURL, strings.EqualFold(result.Illust.Type, "ugoira"), nil
}

func (i *instance) getArtworkDetail(id string) (*Response, error) {
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
	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		body, _ := io.ReadAll(resp.Body)
		return nil, fmt.Errorf("pixiv artwork detail failed: status=%d artwork_id=%s body=%s", resp.StatusCode, id, strings.TrimSpace(string(body)))
	}

	var result Response
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return nil, err
	}
	return &result, nil
}

func (i *instance) parseGetArtwork(result *Response) (*nekomaid.ArtworkMain, error) {
	var o = &nekomaid.ArtworkMain{
		Site:       "pixiv",
		AuthorId:   strconv.FormatInt(result.Illust.User.Id, 10),
		ArtworkId:  strconv.FormatInt(result.Illust.Id, 10),
		Title:      result.Illust.Title,
		IsR18:      result.Illust.Restrict > 0,
		IsAnimated: strings.EqualFold(result.Illust.Type, "ugoira"),
		CreatedOn:  time.Now(),
	}

	var tags []string
	for _, t := range result.Illust.Tags {
		tags = append(tags, t.Name)
	}

	var photos []nekomaid.ArtworkPhoto
	var thumb string

	if o.IsAnimated {
		p, t, err := i.getUgoiraUpload(o.ArtworkId)
		if err != nil {
			return nil, err
		}
		thumb = t
		photos = append(photos, p)
	} else if result.Illust.PageCount > 1 {
		for idx, page := range result.Illust.MetaPages {
			p, t, err := i.getImageUpload(o.AuthorId, o.ArtworkId, page.ImageUrls.Original, idx)
			if err != nil {
				return nil, err
			}
			if idx == 0 {
				thumb = t
			}
			photos = append(photos, p)
		}
	} else {
		p, t, err := i.getImageUpload(o.AuthorId, o.ArtworkId, result.Illust.MetaSinglePage.OriginalImageUrl, 0)
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
		IsAnimated: map[bool]int{true: 1, false: 0}[o.IsAnimated],
		PreviewUrl: fmt.Sprintf(nm.PreviewUrlPattern, enum.NekomaidSitePixiv, o.AuthorId, o.ArtworkId),
	}

	return o, nil
}

func (i *instance) getImageUpload(authorId, artworkId string, u string, idx int) (nekomaid.ArtworkPhoto, string, error) {
	req, _ := http.NewRequest(http.MethodGet, u, nil)
	req.Header.Add("Referer", "https://app-api.pixiv.net/")
	req.Header.Add("User-Agent", "PixivAndroidApp/5.0.64 (Android 6.0)")

	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return nekomaid.ArtworkPhoto{}, "", err
	}
	defer resp.Body.Close()

	return nm.UploadImage(enum.NekomaidSitePixiv, authorId, artworkId, resp, idx)
}

func (i *instance) getUgoiraUpload(artworkId string) (nekomaid.ArtworkPhoto, string, error) {
	metadata, err := i.getUgoiraMetadata(artworkId)
	if err != nil {
		return nekomaid.ArtworkPhoto{}, "", err
	}
	if metadata.UgoiraMetadata.ZipUrls.Medium == "" {
		return nekomaid.ArtworkPhoto{}, "", fmt.Errorf("pixiv ugoira metadata has no zip url: artwork_id=%s", artworkId)
	}

	zipData, err := i.downloadPixivAsset(metadata.UgoiraMetadata.ZipUrls.Medium)
	if err != nil {
		return nekomaid.ArtworkPhoto{}, "", err
	}

	webmData, preview, err := buildUgoiraWebM(zipData, metadata.UgoiraMetadata.Frames)
	if err != nil {
		return nekomaid.ArtworkPhoto{}, "", err
	}

	return nm.UploadUgoira(enum.NekomaidSitePixiv, artworkId, webmData, zipData, preview, metadata.UgoiraMetadata.ZipUrls.Medium)
}

func (i *instance) getUgoiraMetadata(artworkId string) (*UgoiraMetadataResponse, error) {
	client := http.Client{}
	apiUrl := fmt.Sprintf("%s/ugoira/metadata?illust_id=%s", ApiUrl, artworkId)
	req, _ := http.NewRequest(http.MethodGet, apiUrl, nil)
	req.Header.Add("Authorization", "Bearer "+i.Token.AccessToken)
	req.Header.Add("User-Agent", "PixivAndroidApp/5.0.64 (Android 6.0)")

	resp, err := client.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()
	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		body, _ := io.ReadAll(resp.Body)
		return nil, fmt.Errorf("pixiv ugoira metadata failed: status=%d artwork_id=%s body=%s", resp.StatusCode, artworkId, strings.TrimSpace(string(body)))
	}

	var result UgoiraMetadataResponse
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return nil, err
	}
	return &result, nil
}

func (i *instance) downloadPixivAsset(u string) ([]byte, error) {
	req, _ := http.NewRequest(http.MethodGet, u, nil)
	req.Header.Add("Referer", "https://app-api.pixiv.net/")
	req.Header.Add("User-Agent", "PixivAndroidApp/5.0.64 (Android 6.0)")

	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()
	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return nil, fmt.Errorf("download pixiv asset failed: status=%d url=%s", resp.StatusCode, u)
	}
	return io.ReadAll(resp.Body)
}

func buildUgoiraWebM(zipData []byte, frames []ugoiraFrame) ([]byte, image.Image, error) {
	if len(frames) == 0 {
		return nil, nil, fmt.Errorf("pixiv ugoira has no frames")
	}

	reader, err := zip.NewReader(bytes.NewReader(zipData), int64(len(zipData)))
	if err != nil {
		return nil, nil, err
	}

	files := make(map[string]*zip.File, len(reader.File))
	for _, file := range reader.File {
		files[file.Name] = file
	}

	workDir, err := os.MkdirTemp("", "nekomaid-ugoira-*")
	if err != nil {
		return nil, nil, err
	}
	defer os.RemoveAll(workDir)

	concatPath := filepath.Join(workDir, "frames.txt")
	concatFile, err := os.Create(concatPath)
	if err != nil {
		return nil, nil, err
	}

	var preview image.Image
	for idx, frame := range frames {
		file := files[frame.File]
		if file == nil {
			_ = concatFile.Close()
			return nil, nil, fmt.Errorf("pixiv ugoira frame not found in zip: %s", frame.File)
		}

		frameData, err := readZipFile(file)
		if err != nil {
			_ = concatFile.Close()
			return nil, nil, err
		}

		framePath := filepath.Join(workDir, fmt.Sprintf("frame_%06d%s", idx, filepath.Ext(frame.File)))
		if err := os.WriteFile(framePath, frameData, 0600); err != nil {
			_ = concatFile.Close()
			return nil, nil, err
		}

		if idx == 0 {
			img, _, err := image.Decode(bytes.NewReader(frameData))
			if err != nil {
				_ = concatFile.Close()
				return nil, nil, err
			}
			preview = img
		}

		duration := float64(frame.Delay) / 1000
		if duration <= 0 {
			duration = 0.1
		}
		if _, err := fmt.Fprintf(concatFile, "file '%s'\nduration %.3f\n", escapeFFmpegConcatPath(framePath), duration); err != nil {
			_ = concatFile.Close()
			return nil, nil, err
		}
	}

	lastFramePath := filepath.Join(workDir, fmt.Sprintf("frame_%06d%s", len(frames)-1, filepath.Ext(frames[len(frames)-1].File)))
	if _, err := fmt.Fprintf(concatFile, "file '%s'\n", escapeFFmpegConcatPath(lastFramePath)); err != nil {
		_ = concatFile.Close()
		return nil, nil, err
	}
	if err := concatFile.Close(); err != nil {
		return nil, nil, err
	}

	outputPath := filepath.Join(workDir, "ugoira.webm")
	cmd := exec.Command(
		"ffmpeg",
		"-hide_banner",
		"-loglevel", "error",
		"-y",
		"-f", "concat",
		"-safe", "0",
		"-i", concatPath,
		"-an",
		"-c:v", "libvpx",
		"-pix_fmt", "yuv420p",
		"-deadline", "good",
		"-b:v", "0",
		"-crf", "32",
		outputPath,
	)
	if output, err := cmd.CombinedOutput(); err != nil {
		return nil, nil, fmt.Errorf("failed to convert pixiv ugoira to webm: %w: %s", err, strings.TrimSpace(string(output)))
	}

	webmData, err := os.ReadFile(outputPath)
	if err != nil {
		return nil, nil, err
	}
	return webmData, preview, nil
}

func readZipFile(file *zip.File) ([]byte, error) {
	rc, err := file.Open()
	if err != nil {
		return nil, err
	}
	defer rc.Close()

	return io.ReadAll(rc)
}

func escapeFFmpegConcatPath(path string) string {
	return strings.ReplaceAll(path, "'", "'\\''")
}
