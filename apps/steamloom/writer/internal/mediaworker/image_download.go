package mediaworker

import (
	"bytes"
	"context"
	"fmt"
	"image"
	_ "image/gif"
	_ "image/jpeg"
	_ "image/png"
	"io"
	"net/http"
	"os"
	"path/filepath"
)

var supportedImageTypes = map[string]string{"image/png": ".png", "image/jpeg": ".jpg", "image/webp": ".webp", "image/gif": ".gif"}

// downloadImage 下載公開產物且不附帶 provider 認證，避免把 API key 洩漏給 CDN。
func downloadImage(ctx context.Context, client *http.Client, mediaURL, pathWithoutExt string, maxBytes int64) (GeneratedArtifact, error) {
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, mediaURL, nil)
	if err != nil {
		return GeneratedArtifact{}, err
	}
	response, err := client.Do(req)
	if err != nil {
		return GeneratedArtifact{}, err
	}
	defer response.Body.Close()
	if response.StatusCode != http.StatusOK {
		return GeneratedArtifact{}, fmt.Errorf("HTTP %d", response.StatusCode)
	}
	raw, err := io.ReadAll(io.LimitReader(response.Body, maxBytes+1))
	if err != nil {
		return GeneratedArtifact{}, err
	}
	if int64(len(raw)) > maxBytes {
		return GeneratedArtifact{}, fmt.Errorf("圖片超過 %dMB", maxBytes>>20)
	}
	mimeType := http.DetectContentType(raw)
	extension, ok := supportedImageTypes[mimeType]
	if !ok {
		return GeneratedArtifact{}, fmt.Errorf("不支援的圖片格式 %s", mimeType)
	}
	path := pathWithoutExt + extension
	if err := os.WriteFile(path, raw, 0o600); err != nil {
		return GeneratedArtifact{}, err
	}
	// WebP 沒有註冊 decoder，尺寸留 0 不影響後續上傳。
	config, _, _ := image.DecodeConfig(bytes.NewReader(raw))
	return GeneratedArtifact{LocalPath: path, FileName: filepath.Base(path), MIMEType: mimeType, Width: config.Width, Height: config.Height}, nil
}
