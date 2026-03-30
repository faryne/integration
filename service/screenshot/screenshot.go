package screenshot

import (
	"bytes"
	"context"
	"encoding/base64"
	"faryne.dev/config"
	"faryne.dev/service/chrome_helper"
	"fmt"
	"github.com/chromedp/chromedp"
	"github.com/disintegration/imaging"
	"github.com/minio/sha256-simd"
	"github.com/skip2/go-qrcode"
	"golang.org/x/image/font"
	"golang.org/x/image/math/fixed"
	"image"
	"image/png"
	"os"
	"time"
)

type QRCodePosition int

const (
	TopLeft QRCodePosition = iota
	TopRight
	BottomLeft
	BottomRight
)

func Screenshot(uri string) {
	captureTime := time.Now().UTC() // 擷取時間，使用 UTC
	sha256Key := string(sha256.New().Sum([]byte(uri)))
	historyUrl := config.EnvConfig().FrontendPath + fmt.Sprintf("/tools/webshot/%s", sha256Key)

	// 產生 QR Code
	qrCode, qrCodeError := qrcode.Encode(historyUrl, qrcode.Medium, 100)
	if qrCodeError != nil {
		return
	}
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
	`, uri, captureTime.Format(time.RFC3339), base64.StdEncoding.EncodeToString(qrCode))

	// 先截圖
	inst := chrome_helper.NewDefaultInstance()
	var fullPageBytes []byte
	actions := chromedp.Tasks{
		chromedp.EmulateViewport(1440, 900),
		chromedp.Navigate(uri),
		chromedp.Poll(`document.readyState === "complete"`, nil),
		chromedp.Sleep(3 * time.Second),
		chromedp.ActionFunc(func(ctx context.Context) error {
			// 先捲動到最下面
			err := chromedp.Evaluate(`window.scrollTo(0, document.body.scrollHeight)`, nil).Do(ctx)
			if err != nil {
				return err
			}
			// 等 1 秒讓圖片載入
			time.Sleep(1 * time.Second)
			err1 := chromedp.Evaluate(injectJS, nil).Do(ctx)
			if err1 != nil {
				return err1
			}
			// 捲動回最上面，準備截圖
			return chromedp.Evaluate(`window.scrollTo(0, 0)`, nil).Do(ctx)
		}),
		chromedp.FullScreenshot(&fullPageBytes, 100),
	}
	for _, c := range inst.Cancels {
		defer c()
	}
	err := chromedp.Run(inst.Ctx, actions)
	if err != nil {
		fmt.Println(err.Error())
		return
	}

	// 將 QR Code 與網頁截圖合成在一起
	fullImg, _, err := image.Decode(bytes.NewReader(fullPageBytes))
	if err != nil {
		return
	}

	// 寫入 buffer 準備傳上 s3
	f1, _ := os.Create("a.png")
	//var buf1 bytes.Buffer
	if err := png.Encode(f1, fullImg); err != nil {
		return
	}

	// 處理縮圖
	//var buf2 bytes.Buffer
	f2, _ := os.Create("a_thumb.png")
	thumbImg := imaging.Resize(fullImg, 300, 0, imaging.Lanczos)
	if err := png.Encode(f2, thumbImg); err != nil {
		return
	}

	// 將原圖和縮圖都丟到 s3 @TODO

	// 寫回到資料庫
}

// 文字繪製輔助函式
func drawText(d *font.Drawer, x, y int, label, content string) {
	d.Dot = fixed.P(x, y)
	d.DrawString(label + " " + content)
}

// 網址截斷輔助函式
func truncateUrl(u string, limit int) string {
	if len(u) > limit {
		return u[:limit-3] + "..."
	}
	return u
}
