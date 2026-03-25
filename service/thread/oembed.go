package thread

import (
	"encoding/base64"
	"encoding/json"
	"faryne.dev/service/chrome_helper"
	"fmt"
	"github.com/chromedp/chromedp"
	"io"
	"net/http"
	"net/url"
	"time"
)

type OembedThread struct {
	Html         string `json:"html"`
	ProviderName string `json:"provider_name"`
	ProviderUrl  string `json:"provider_url"`
	Type         string `json:"type"`
	Version      string `json:"version"`
	Width        int64  `json:"width"`
}

var oembedHtml = `
		<!DOCTYPE html>
		<html>
		<head>
			<meta charset="UTF-8">
			<style>
				body { 
					margin: 0; 
					display: flex; 
					justify-content: center; 
					background: transparent; 
				}
			</style>
		</head>
		<body>
			<div id="capture-result">%s</div>
		</body>
		</html>
	`

func OEmbedCapture(uri string) (string, error) {
	newUri := "https://graph.threads.net/v1.0/oembed?" + url.Values{"url": {uri}}.Encode()
	if uri == "" || uri[0] != 'h' {
		return "", fmt.Errorf("uri is not matched: %s", uri)
	}
	resp, err := http.DefaultClient.Get(newUri)
	if err != nil {
		return "", err
	}
	defer resp.Body.Close()

	content, err := io.ReadAll(resp.Body)
	if err != nil {
		return "", err
	}

	var t OembedThread
	if unmarshalError := json.Unmarshal(content, &t); unmarshalError != nil {
		return "", err
	}
	if t.Html == "" {
		return "", fmt.Errorf("html is empty, cannot capture oembed html")
	}

	// 開始截圖
	var buf []byte
	chromeDpInstance := chrome_helper.NewDefaultInstance()
	dataUri := fmt.Sprintf("data:text/html;charset=utf-8,%s", url.PathEscape(fmt.Sprintf(oembedHtml, t.Html)))
	fmt.Println(dataUri)
	if len(chromeDpInstance.Cancels) > 0 {
		for _, v := range chromeDpInstance.Cancels {
			defer v()
		}
	}
	chromeDpError := chromedp.Run(
		chromeDpInstance.Ctx,
		chromedp.Navigate(dataUri),
		chromedp.WaitVisible(`#capture-result`, chromedp.ByQuery),
		chromedp.WaitReady(`iframe`, chromedp.ByQuery),
		chromedp.Sleep(3*time.Second),
		chromedp.Screenshot(`#capture-result`, &buf, chromedp.ByQuery),
	)
	if chromeDpError != nil {
		return "", chromeDpError
	}

	str := base64.StdEncoding.EncodeToString(buf)
	return str, nil

}
