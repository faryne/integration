package rates

import (
	"bytes"
	"context"
	"errors"
	"fmt"
	"io"
	"net/http"
	"strings"
	"time"

	"go.uber.org/zap"

	"faryne.dev/service/helper"
	"faryne.dev/service/log"
)

const (
	requestTimeout  = 15 * time.Second
	requestAttempts = 3 // 第一次＋重試 2 次
	retryDelay      = 3 * time.Second
	userAgent       = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36"
)

// errChallenge 被 WAF / JS challenge 擋下；不嘗試繞過，直接回報
var errChallenge = errors.New("blocked by bot challenge")

// fetch 送出請求並回傳 body；網路錯誤或 5xx 會重試，4xx 與 challenge 頁直接放棄
func fetch(ctx context.Context, method, uri, body string, headers map[string]string) ([]byte, error) {
	var lastErr error
	for attempt := 1; attempt <= requestAttempts; attempt++ {
		if attempt > 1 {
			log.Logger().Warn("Retry rates request", zap.String("url", uri), zap.Int("attempt", attempt), zap.Error(lastErr))
			select {
			case <-ctx.Done():
				return nil, ctx.Err()
			case <-time.After(retryDelay):
			}
		}

		content, status, err := doOnce(ctx, method, uri, body, headers)
		switch {
		case err != nil:
			lastErr = err
		case status >= 500:
			lastErr = fmt.Errorf("http status %d", status)
		case status >= 400:
			return nil, fmt.Errorf("http status %d", status)
		case bytes.Contains(content, []byte("Challenge Validation")):
			return nil, errChallenge
		default:
			return content, nil
		}
	}
	return nil, lastErr
}

func doOnce(ctx context.Context, method, uri, body string, headers map[string]string) ([]byte, int, error) {
	ctx, cancel := context.WithTimeout(ctx, requestTimeout)
	defer cancel()

	var reader io.Reader
	if body != "" {
		reader = strings.NewReader(body)
	}
	req, err := http.NewRequestWithContext(ctx, method, uri, reader)
	if err != nil {
		return nil, 0, err
	}
	req.Header.Set("User-Agent", userAgent)
	for k, v := range headers {
		req.Header.Set(k, v)
	}
	return helper.DoRawWithStatus(req)
}
