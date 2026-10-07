package sns

import (
	"bytes"
	"fmt"
	"image"
	"image/jpeg"
	"io"
	"net/http"
	"strings"
	"time"

	storytellerModel "faryne.dev/model/entity/storyteller"
	"faryne.dev/model/enum"
	"faryne.dev/service/client"
	"faryne.dev/service/log"

	"github.com/disintegration/imaging"
	"go.uber.org/zap"

	// 封面常見 webp，imaging 本身只註冊 jpeg/png/gif/tiff/bmp
	_ "golang.org/x/image/webp"
)

// SteamLoom 預覽圖卡：依閱讀頁網址找出要用的圖（圖像話第一頁或專案封面），合成 1200×630 JPEG。
// 圖上不壓字：平台卡片本身會顯示標題和描述，壓字還要內嵌 CJK 字型，不划算。

const (
	ogImageCacheTTL     = 7 * 24 * time.Hour
	ogImageFailCacheTTL = 5 * time.Minute
	// ogImageMaxSourceBytes／ogImageMaxSourcePixels 擋超大原圖，避免解碼吃爆記憶體
	ogImageMaxSourceBytes  = 25 << 20
	ogImageMaxSourcePixels = 40_000_000
	// ogImageLandscapeRatio 以上視為橫幅圖，直接依焦點裁切；以下（直式書封、方圖）用模糊背景＋完整原圖
	ogImageLandscapeRatio = 1.6
	ogImageJPEGQuality    = 85
)

// OGImageResult 是圖卡端點的結果：Status=200 帶 Body；302 帶 RedirectURL（品牌預設圖）；404 代表讀者看不到
type OGImageResult struct {
	Status      int
	Body        []byte
	RedirectURL string
}

var fetchOGImageSource = fetchOGImageSourceFromURL

// StorytellerOGImage rawPath 是 /og-image 之後的閱讀頁路徑（nginx 已補上 storyteller/ 前綴），結尾的 .jpg 可有可無
func StorytellerOGImage(rawPath string) OGImageResult {
	fallback := OGImageResult{Status: http.StatusFound, RedirectURL: steamloomOrigin + steamloomDefaultImagePath}
	target, ok := resolveStorytellerTarget(normalizeFrontendPath(strings.TrimSuffix(rawPath, ".jpg")))
	if !ok || target.NotFound {
		return OGImageResult{Status: http.StatusNotFound}
	}
	// 暫時性錯誤、限制級都退回品牌預設圖
	if target.Err != nil || target.Project.Restricted {
		return fallback
	}
	source, ok := storytellerImage(target)
	if !ok {
		return fallback
	}
	body, err := storytellerOGImageBytes(source)
	if err != nil {
		log.Logger().Warn("SNS og image compose failed", zap.String("path", rawPath), zap.Error(err))
		return fallback
	}
	return OGImageResult{Status: http.StatusOK, Body: body}
}

// storytellerOGImageBytes 先查 Redis；合成失敗也短暫記住，避免爬蟲反覆重試同一張壞圖
func storytellerOGImageBytes(source storytellerImageSource) ([]byte, error) {
	key := "sns:og:v1:" + source.version()
	failKey := key + ":fail"
	r := client.GetRedis(enum.RedisDefault)
	if r != nil {
		if body, err := r.Get(key).Bytes(); err == nil && len(body) > 0 {
			return body, nil
		}
		if exists, _ := r.Exists(failKey).Result(); exists > 0 {
			return nil, fmt.Errorf("og image recently failed")
		}
	}
	body, err := composeStorytellerOGImage(source)
	if r != nil {
		if err != nil {
			_ = r.Set(failKey, "1", ogImageFailCacheTTL).Err()
		} else {
			_ = r.Set(key, body, ogImageCacheTTL).Err()
		}
	}
	return body, err
}

func composeStorytellerOGImage(source storytellerImageSource) ([]byte, error) {
	raw, err := fetchOGImageSource(source.url)
	if err != nil {
		return nil, err
	}
	config, _, err := image.DecodeConfig(bytes.NewReader(raw))
	if err != nil {
		return nil, fmt.Errorf("decode og source config: %w", err)
	}
	if config.Width*config.Height > ogImageMaxSourcePixels {
		return nil, fmt.Errorf("og source too large: %dx%d", config.Width, config.Height)
	}
	src, err := imaging.Decode(bytes.NewReader(raw), imaging.AutoOrientation(true))
	if err != nil {
		return nil, fmt.Errorf("decode og source: %w", err)
	}
	var out bytes.Buffer
	if err := jpeg.Encode(&out, composeOGCanvas(src, source.focal), &jpeg.Options{Quality: ogImageJPEGQuality}); err != nil {
		return nil, err
	}
	return out.Bytes(), nil
}

// composeOGCanvas 橫幅圖依焦點裁切；直式／方圖放大模糊壓暗當背景，中間放完整不裁切的原圖
func composeOGCanvas(src image.Image, focal storytellerModel.ProjectCoverFocalPoint) image.Image {
	const width, height = storytellerOGImageWidth, storytellerOGImageHeight
	bounds := src.Bounds()
	if float64(bounds.Dx())/float64(bounds.Dy()) >= ogImageLandscapeRatio {
		return imaging.Resize(cropAroundFocal(src, float64(width)/float64(height), focal), width, height, imaging.Lanczos)
	}
	// 先縮小再模糊再放大，比直接在大圖上 Blur 便宜很多，效果差不多
	background := imaging.Fill(src, width/8, height/8, imaging.Center, imaging.Linear)
	background = imaging.Resize(imaging.Blur(background, 2), width, height, imaging.Linear)
	background = imaging.AdjustBrightness(background, -35)
	const padding = 30
	foreground := imaging.Fit(src, width-padding*2, height-padding*2, imaging.Lanczos)
	return imaging.PasteCenter(background, foreground)
}

// cropAroundFocal 裁出指定比例、盡量以焦點（0～1 正規化座標）為中心的最大區塊
func cropAroundFocal(src image.Image, ratio float64, focal storytellerModel.ProjectCoverFocalPoint) image.Image {
	bounds := src.Bounds()
	return imaging.Crop(src, focalCropRect(bounds.Dx(), bounds.Dy(), ratio, focal).Add(bounds.Min))
}

// focalCropRect 算出裁切範圍（原點為 0,0），超出原圖邊界就往內推
func focalCropRect(w, h int, ratio float64, focal storytellerModel.ProjectCoverFocalPoint) image.Rectangle {
	cropW, cropH := w, int(float64(w)/ratio)
	if cropH > h {
		cropW, cropH = int(float64(h)*ratio), h
	}
	clamp := func(v, hi int) int { return min(max(v, 0), hi) }
	x := clamp(int(focal.X*float64(w))-cropW/2, w-cropW)
	y := clamp(int(focal.Y*float64(h))-cropH/2, h-cropH)
	return image.Rect(x, y, x+cropW, y+cropH)
}

func fetchOGImageSourceFromURL(sourceURL string) ([]byte, error) {
	httpClient := http.Client{Timeout: 10 * time.Second}
	resp, err := httpClient.Get(sourceURL)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()
	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return nil, fmt.Errorf("og source status %d", resp.StatusCode)
	}
	body, err := io.ReadAll(io.LimitReader(resp.Body, ogImageMaxSourceBytes+1))
	if err != nil {
		return nil, err
	}
	if len(body) > ogImageMaxSourceBytes {
		return nil, fmt.Errorf("og source exceeds %d bytes", ogImageMaxSourceBytes)
	}
	return body, nil
}
