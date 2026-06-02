package screenshot

import (
	"bytes"
	"context"
	"encoding/base64"
	"errors"
	"fmt"
	"html"
	"image"
	"image/draw"
	"image/png"
	"math"
	"strings"
	"sync"
	"time"

	"faryne.dev/config"
	modelTools "faryne.dev/model/entity/tools"
	"faryne.dev/repository"
	toolsRepo "faryne.dev/repository/tools"
	"faryne.dev/service/chrome_helper"
	"faryne.dev/service/helper"

	"github.com/aws/aws-sdk-go-v2/aws"
	awsconfig "github.com/aws/aws-sdk-go-v2/config"
	"github.com/aws/aws-sdk-go-v2/credentials"
	"github.com/aws/aws-sdk-go-v2/service/s3"
	"github.com/chromedp/cdproto/page"
	"github.com/chromedp/chromedp"
	"github.com/disintegration/imaging"
	"github.com/skip2/go-qrcode"
)

var ErrWebshotNotFound = errors.New("webshot not found")

func IsWebshotNotFound(err error) bool {
	return errors.Is(err, ErrWebshotNotFound)
}

type QRCodePosition int

const (
	TopLeft QRCodePosition = iota
	TopRight
	BottomLeft
	BottomRight
)

type WebshotHistoryResponse struct {
	modelTools.WebshotHistory
	FullImageUrl  string `json:"full_image_url"`
	ThumbImageUrl string `json:"thumb_image_url"`
}

type WebshotResponse struct {
	modelTools.WebshotMain
	History            []WebshotHistoryResponse `json:"history"`
	HistoryCurrentPage int64                    `json:"history_current_page"`
	HistoryLastPage    int64                    `json:"history_last_page"`
	HistoryPerPage     int64                    `json:"history_per_page"`
	HistoryTotal       int64                    `json:"history_total"`
}

const (
	webshotViewportWidth     int64 = 1440
	webshotViewportHeight    int64 = 900
	webshotScrollStep        int64 = 800
	webshotSingleCaptureMaxH int64 = 16000
)

func Screenshot(uri string) (*WebshotResponse, error) {
	startTime := time.Now()
	captureTime := time.Now().UTC() // 擷取時間，使用 UTC
	sha256Key := helper.SHA256Hex(uri)
	historyUrl := config.EnvConfig().FrontendPath + fmt.Sprintf("/tools/webshot/%s", sha256Key)

	// 產生 QR Code
	qrCode, qrCodeError := qrcode.Encode(historyUrl, qrcode.Medium, 100)
	if qrCodeError != nil {
		return nil, qrCodeError
	}
	displayUri := strings.NewReplacer("\\", "\\\\", "\"", "\\\"", "\n", " ", "\r", " ").Replace(html.EscapeString(uri))
	injectJS := fmt.Sprintf(`
		(function() {
			var f = document.createElement("div");
			f.id = "websnap-footer";
			f.style.cssText = "background:#fff; color:#333; font-family:sans-serif; display:flex; align-items:center; padding:25px; border-top:1px solid #eee; width:100%%; box-sizing:border-box; z-index:999999; position:relative;";
			
			f.innerHTML = "<div style='flex:1; overflow:hidden;'>" +
				"<div style='font-size:12px; color:#888; margin-bottom:4px;'>SNAPSHOT ARCHIVE</div>" +
				"<div style='font-size:16px; font-weight:bold; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;'>%s</div>" +
				"<div style='font-size:12px; color:#666; margin-top:4px;'>擷取日期：%s</div>" +
			"</div>" +
			"<div style='display:flex; align-items:center; margin-left:20px;'>" +
				"<div style='text-align:right; margin-right:12px;'>" +
					"<div style='font-size:13px; font-weight:bold;'>掃描 QR Code</div>" +
					"<div style='font-size:11px; color:#999;'>查看歷史存檔</div>" +
				"</div>" +
				"<img src='data:image/png;base64,%s' style='width:80px; height:80px; border:1px solid #eee; padding:2px;'>" +
			"</div>";

			document.body.appendChild(f);
		})();
	`, displayUri, captureTime.Format(time.RFC3339), base64.StdEncoding.EncodeToString(qrCode))

	// 先截圖
	inst := chrome_helper.NewDefaultInstanceWithTimeout(120 * time.Second)
	var fullPageBytes []byte
	actions := chromedp.Tasks{
		chromedp.EmulateViewport(webshotViewportWidth, webshotViewportHeight),
		chromedp.Navigate(uri),
		chromedp.Poll(`document.readyState === "complete"`, nil),
		chromedp.Sleep(2 * time.Second),
		chromedp.ActionFunc(func(ctx context.Context) error {
			if err := preloadPageForScreenshot(ctx); err != nil {
				return err
			}
			if err := chromedp.Evaluate(injectJS, nil).Do(ctx); err != nil {
				return err
			}
			time.Sleep(500 * time.Millisecond)
			return captureFullPage(ctx, &fullPageBytes)
		}),
	}
	for _, c := range inst.Cancels {
		defer c()
	}
	err := chromedp.Run(inst.Ctx, actions)
	if err != nil {
		return nil, err
	}

	// 將 QR Code 與網頁截圖合成在一起
	fullImg, _, err := image.Decode(bytes.NewReader(fullPageBytes))
	if err != nil {
		return nil, err
	}

	// 寫入 buffer 準備傳上 s3
	var fullBuf bytes.Buffer
	if err := png.Encode(&fullBuf, fullImg); err != nil {
		return nil, err
	}

	// 處理縮圖
	var thumbBuf bytes.Buffer
	thumbImg := imaging.Resize(fullImg, 300, 0, imaging.Lanczos)
	if err := png.Encode(&thumbBuf, thumbImg); err != nil {
		return nil, err
	}

	fullPath, thumbPath := imageObjectKeys(sha256Key, captureTime)
	screenshotDurationMs := time.Since(startTime).Milliseconds()
	uploadStartTime := time.Now()
	if err := putImages(context.TODO(), map[string][]byte{
		fullPath:  fullBuf.Bytes(),
		thumbPath: thumbBuf.Bytes(),
	}); err != nil {
		return nil, err
	}
	uploadDurationMs := time.Since(uploadStartTime).Milliseconds()

	// 寫回到資料庫
	mainRepo := toolsRepo.NewWebshotMain()
	main, err := mainRepo.FindOrCreate(uri, sha256Key)
	if err != nil {
		return nil, err
	}

	historyRepo := toolsRepo.NewWebshotHistory()
	history := modelTools.WebshotHistory{
		MainId:               main.Id,
		FullImagePath:        fullPath,
		ThumbImagePath:       thumbPath,
		ScreenshotDurationMs: screenshotDurationMs,
		UploadDurationMs:     uploadDurationMs,
		CreatedAt:            captureTime,
	}
	if err := historyRepo.CreateHistory(&history); err != nil {
		return nil, err
	}

	return responseFrom(main, []modelTools.WebshotHistory{history}, 1, 10, 1), nil
}

type pageCaptureSize struct {
	Width  int64 `json:"width"`
	Height int64 `json:"height"`
}

func measurePageCaptureSize(ctx context.Context) (pageCaptureSize, error) {
	var size pageCaptureSize
	err := chromedp.Evaluate(fmt.Sprintf(`(() => {
		const de = document.documentElement;
		const body = document.body || de;
		return {
			width: Math.ceil(Math.max(%d, de.clientWidth, body.clientWidth || 0)),
			height: Math.ceil(Math.max(%d, de.clientHeight, de.scrollHeight, body.clientHeight || 0, body.scrollHeight || 0, body.offsetHeight || 0))
		};
	})()`, webshotViewportWidth, webshotViewportHeight), &size).Do(ctx)
	if err != nil {
		return size, err
	}
	if size.Width <= 0 {
		size.Width = webshotViewportWidth
	}
	if size.Height <= 0 {
		size.Height = webshotViewportHeight
	}
	return size, nil
}

func preloadPageForScreenshot(ctx context.Context) error {
	lastHeight := int64(0)
	for pass := 0; pass < 3; pass++ {
		size, err := measurePageCaptureSize(ctx)
		if err != nil {
			return err
		}

		for y := int64(0); y < size.Height; y += webshotScrollStep {
			if err := scrollTo(ctx, y); err != nil {
				return err
			}
			time.Sleep(80 * time.Millisecond)
		}
		if err := scrollTo(ctx, size.Height); err != nil {
			return err
		}
		time.Sleep(300 * time.Millisecond)

		if size.Height == lastHeight {
			break
		}
		lastHeight = size.Height
	}
	return scrollTo(ctx, 0)
}

func scrollTo(ctx context.Context, y int64) error {
	return chromedp.Evaluate(fmt.Sprintf(`window.scrollTo(0, %d)`, y), nil).Do(ctx)
}

func captureFullPage(ctx context.Context, out *[]byte) error {
	size, err := measurePageCaptureSize(ctx)
	if err != nil {
		return err
	}

	if size.Height <= webshotSingleCaptureMaxH {
		buf, err := capturePageClip(ctx, 0, float64(size.Width), float64(size.Height))
		if err != nil {
			return err
		}
		*out = buf
		return nil
	}

	return captureFullPageByChunks(ctx, size, out)
}

func capturePageClip(ctx context.Context, y float64, width float64, height float64) ([]byte, error) {
	return page.CaptureScreenshot().
		WithFormat(page.CaptureScreenshotFormatPng).
		WithCaptureBeyondViewport(true).
		WithFromSurface(true).
		WithClip(&page.Viewport{
			X:      0,
			Y:      y,
			Width:  width,
			Height: height,
			Scale:  1,
		}).
		Do(ctx)
}

func captureFullPageByChunks(ctx context.Context, size pageCaptureSize, out *[]byte) error {
	canvas := image.NewRGBA(image.Rect(0, 0, int(size.Width), int(size.Height)))

	for y := int64(0); y < size.Height; y += webshotSingleCaptureMaxH {
		chunkHeight := webshotSingleCaptureMaxH
		if remain := size.Height - y; remain < chunkHeight {
			chunkHeight = remain
		}

		buf, err := capturePageClip(ctx, float64(y), float64(size.Width), float64(chunkHeight))
		if err != nil {
			return err
		}
		chunkImg, _, err := image.Decode(bytes.NewReader(buf))
		if err != nil {
			return err
		}
		draw.Draw(canvas, image.Rect(0, int(y), int(y)+chunkImg.Bounds().Dx(), int(y)+chunkImg.Bounds().Dy()), chunkImg, chunkImg.Bounds().Min, draw.Src)
	}

	var buf bytes.Buffer
	if err := png.Encode(&buf, canvas); err != nil {
		return err
	}
	*out = buf.Bytes()
	return nil
}

func GetHistory(urlHash string, page int64, perPage int64) (*WebshotResponse, error) {
	mainRepo := toolsRepo.NewWebshotMain()
	main, err := mainRepo.GetByHash(urlHash)
	if err != nil {
		if repository.IsRecordNotFound(err) {
			return nil, ErrWebshotNotFound
		}
		return nil, err
	}

	historyRepo := toolsRepo.NewWebshotHistory()
	rows, total, err := historyRepo.ListByMainId(main.Id, page, perPage)
	if err != nil {
		return nil, err
	}
	return responseFrom(main, rows, page, perPage, total), nil
}

func ListRecent() ([]WebshotResponse, error) {
	mainRepo := toolsRepo.NewWebshotMain()
	rows, err := mainRepo.ListRecent(30)
	if err != nil {
		return nil, err
	}

	out := make([]WebshotResponse, 0, len(rows))
	for _, row := range rows {
		main := row
		out = append(out, *responseFrom(&main, nil, 1, 10, 0))
	}
	return out, nil
}

func imageObjectKeys(urlHash string, captureTime time.Time) (string, string) {
	datePath := captureTime.Format("20060102")
	hashInput := fmt.Sprintf("%s:%s", urlHash, captureTime.Format(time.RFC3339Nano))
	shortKey := helper.ShortSHA256Hex(hashInput, 20)

	return fmt.Sprintf("tools/webshot/%s/%s.png", datePath, shortKey),
		fmt.Sprintf("tools/webshot/%s/%s_thumb.png", datePath, shortKey)
}

func putImage(ctx context.Context, key string, body []byte) error {
	client, err := initS3Client(ctx)
	if err != nil {
		return err
	}
	return putImageWithClient(ctx, client, key, body)
}

func putImageWithClient(ctx context.Context, client *s3.Client, key string, body []byte) error {
	_, err := client.PutObject(ctx, &s3.PutObjectInput{
		Bucket:      aws.String(config.EnvConfig().S3Bucket),
		Key:         aws.String(key),
		Body:        bytes.NewReader(body),
		ContentType: aws.String("image/png"),
	})
	return err
}

func putImages(ctx context.Context, images map[string][]byte) error {
	client, err := initS3Client(ctx)
	if err != nil {
		return err
	}

	var wg sync.WaitGroup
	errCh := make(chan error, len(images))

	for key, body := range images {
		wg.Add(1)
		go func(key string, body []byte) {
			defer wg.Done()
			if err := putImageWithClient(ctx, client, key, body); err != nil {
				errCh <- err
			}
		}(key, body)
	}

	wg.Wait()
	close(errCh)

	for err := range errCh {
		return err
	}
	return nil
}

func initS3Client(ctx context.Context) (*s3.Client, error) {
	staticProvider := credentials.NewStaticCredentialsProvider(config.EnvConfig().S3AccessKey, config.EnvConfig().S3SecretKey, "")
	cfg, err := awsconfig.LoadDefaultConfig(ctx,
		awsconfig.WithRegion(config.EnvConfig().S3Region),
		awsconfig.WithCredentialsProvider(staticProvider),
	)
	if err != nil {
		return nil, fmt.Errorf("無法載入 AWS 設定: %v", err)
	}
	return s3.NewFromConfig(cfg), nil
}

func responseFrom(main *modelTools.WebshotMain, rows []modelTools.WebshotHistory, page int64, perPage int64, total int64) *WebshotResponse {
	history := make([]WebshotHistoryResponse, 0, len(rows))
	for _, row := range rows {
		history = append(history, WebshotHistoryResponse{
			WebshotHistory: row,
			FullImageUrl:   publicAssetUrl(row.FullImagePath),
			ThumbImageUrl:  publicAssetUrl(row.ThumbImagePath),
		})
	}
	lastPage := int64(math.Ceil(float64(total) / float64(perPage)))
	if lastPage <= 0 {
		lastPage = 1
	}

	return &WebshotResponse{
		WebshotMain:        *main,
		History:            history,
		HistoryCurrentPage: page,
		HistoryLastPage:    lastPage,
		HistoryPerPage:     perPage,
		HistoryTotal:       total,
	}
}

func publicAssetUrl(key string) string {
	cdnUrl := strings.TrimRight(config.EnvConfig().CDNUrl, "/")
	if cdnUrl == "" {
		return key
	}
	return cdnUrl + "/" + strings.TrimLeft(key, "/")
}
