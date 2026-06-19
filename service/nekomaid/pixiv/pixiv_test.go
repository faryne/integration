package pixiv

import (
	"io"
	"net/http"
	"strings"
	"testing"
)

func TestDecodePixivJSONResponseRejectsHTML(t *testing.T) {
	resp := &http.Response{
		StatusCode: http.StatusOK,
		Header: http.Header{
			"Content-Type": []string{"text/html; charset=utf-8"},
		},
		Body: io.NopCloser(strings.NewReader("<!doctype html><html><body>blocked</body></html>")),
	}

	var out OAuthAPIResponse
	err := decodePixivJSONResponse(resp, &out, "pixiv artwork detail artwork_id=145524117")
	if err == nil {
		t.Fatal("expected invalid json error")
	}

	message := err.Error()
	if !strings.Contains(message, "pixiv artwork detail artwork_id=145524117 returned invalid json") {
		t.Fatalf("expected context in error, got %q", message)
	}
	if !strings.Contains(message, "content_type=text/html; charset=utf-8") {
		t.Fatalf("expected content type in error, got %q", message)
	}
	if !strings.Contains(message, "<!doctype html>") {
		t.Fatalf("expected body snippet in error, got %q", message)
	}
}

func TestDecodePixivJSONResponseRejectsNonSuccessStatus(t *testing.T) {
	resp := &http.Response{
		StatusCode: http.StatusForbidden,
		Header: http.Header{
			"Content-Type": []string{"application/json"},
		},
		Body: io.NopCloser(strings.NewReader(`{"error":"forbidden"}`)),
	}

	var out OAuthAPIResponse
	err := decodePixivJSONResponse(resp, &out, "pixiv login")
	if err == nil {
		t.Fatal("expected status error")
	}

	message := err.Error()
	if !strings.Contains(message, "pixiv login failed: status=403") {
		t.Fatalf("expected status in error, got %q", message)
	}
	if !strings.Contains(message, `{"error":"forbidden"}`) {
		t.Fatalf("expected body snippet in error, got %q", message)
	}
}

func TestDecodePixivJSONResponseSuccess(t *testing.T) {
	resp := &http.Response{
		StatusCode: http.StatusOK,
		Header: http.Header{
			"Content-Type": []string{"application/json"},
		},
		Body: io.NopCloser(strings.NewReader(`{"access_token":"token","refresh_token":"refresh","expires_in":3600}`)),
	}

	var out OAuthAPIResponse
	if err := decodePixivJSONResponse(resp, &out, "pixiv login"); err != nil {
		t.Fatalf("decode response: %v", err)
	}
	if out.AccessToken != "token" || out.RefreshToken != "refresh" || out.ExpiresIn != 3600 {
		t.Fatalf("unexpected token: %+v", out)
	}
}

func TestWebArtworkToResponse(t *testing.T) {
	var input WebArtworkResponse
	input.Body.Id = "145524117"
	input.Body.Title = "Test title"
	input.Body.Type = "illust"
	input.Body.UserId = "12345"
	input.Body.UserName = "Author"
	input.Body.PageCount = 1
	input.Body.Urls.Original = "https://i.pximg.net/img-original/img/2026/06/19/00/00/00/145524117_p0.png"
	input.Body.Tags.Tags = append(input.Body.Tags.Tags, struct {
		Tag string `json:"tag"`
	}{Tag: "R-18"})

	out, err := webArtworkToResponse(input)
	if err != nil {
		t.Fatalf("convert web artwork: %v", err)
	}
	if out.Illust.Id != 145524117 {
		t.Fatalf("unexpected artwork id: %d", out.Illust.Id)
	}
	if out.Illust.User.Id != 12345 || out.Illust.User.Name != "Author" {
		t.Fatalf("unexpected author: %+v", out.Illust.User)
	}
	if out.Illust.MetaSinglePage.OriginalImageUrl != input.Body.Urls.Original {
		t.Fatalf("unexpected original image url: %q", out.Illust.MetaSinglePage.OriginalImageUrl)
	}
	if len(out.Illust.Tags) != 1 || out.Illust.Tags[0].Name != "R-18" {
		t.Fatalf("unexpected tags: %+v", out.Illust.Tags)
	}
}
