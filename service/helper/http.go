package helper

import (
	"encoding/json"
	"io"
	"net/http"
	"net/url"
)

// DoRequest 發送已構建的 HTTP 請求並解析響應為 T 類型
// 提供最大的靈活性，支持自定義超時、Cookie、中間件等
func DoRequest[T any](req *http.Request) (*T, error) {
	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	content, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, err
	}

	var result T
	if err := json.Unmarshal(content, &result); err != nil {
		return nil, err
	}
	return &result, nil
}

// Do 便捷函數：發送簡單的 HTTP 請求並解析響應為 T 類型
func Do[T any](
	method string,
	uri string,
	query url.Values,
	body io.Reader,
) (*T, error) {
	u, err := url.Parse(uri)
	if err != nil {
		return nil, err
	}

	if query != nil {
		u.RawQuery = query.Encode()
	}

	req, err := http.NewRequest(method, u.String(), body)
	if err != nil {
		return nil, err
	}

	return DoRequest[T](req)
}

// DoWithHeaders 便捷函數：支持自定義請求頭
func DoWithHeaders[T any](
	method string,
	uri string,
	headers map[string]string,
	query url.Values,
	body io.Reader,
) (*T, error) {
	u, err := url.Parse(uri)
	if err != nil {
		return nil, err
	}

	if query != nil {
		u.RawQuery = query.Encode()
	}

	req, err := http.NewRequest(method, u.String(), body)
	if err != nil {
		return nil, err
	}

	for k, v := range headers {
		req.Header.Set(k, v)
	}

	return DoRequest[T](req)
}

// DoRaw 發送請求並返回原始響應體字節
// 用於需要訪問原始響應的場景（如 HTML 解析、流式處理等）
func DoRaw(req *http.Request) ([]byte, error) {
	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	content, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, err
	}

	return content, nil
}

// DoRawWithStatus 發送請求並返回原始響應體字節及狀態碼
// 用於需要檢查 HTTP 狀態碼的場景
func DoRawWithStatus(req *http.Request) ([]byte, int, error) {
	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return nil, 0, err
	}
	defer resp.Body.Close()

	content, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, resp.StatusCode, err
	}

	return content, resp.StatusCode, nil
}
