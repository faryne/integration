package crawler

import (
	"bytes"
	"fmt"
	"github.com/PuerkitoBio/goquery"
	"io"
	"net/http"
	"net/url"
	"strings"
	"time"

	"faryne.dev/config"
)

func CrawlByRequest(req *http.Request, selectors []SelectorRequest) (map[string]any, error) {
	c, err := http.DefaultClient.Do(req)
	if err != nil {
		return nil, err
	}
	defer c.Body.Close()
	b, err := io.ReadAll(c.Body)
	if err != nil {
		return nil, err
	}
	return crawl(b, selectors)
}

func CrawlByUrl(uri string, selectors []SelectorRequest) (map[string]any, error) {
	c, err := http.Get(uri)
	if err != nil {
		return nil, err
	}
	defer c.Body.Close()
	b, err := io.ReadAll(c.Body)
	if err != nil {
		return nil, err
	}
	return crawl(b, selectors)
}

func CrawlByUrlWithTimeout(uri string, selectors []SelectorRequest, timeout time.Duration) (map[string]any, error) {
	client := http.Client{Timeout: timeout}
	c, err := client.Get(uri)
	if err != nil {
		return nil, err
	}
	defer c.Body.Close()
	b, err := io.ReadAll(c.Body)
	if err != nil {
		return nil, err
	}
	return crawl(b, selectors)
}

func CrawlByURLInTaiwan(uri string, selectors []SelectorRequest) (map[string]any, error) {
	return CrawlByURLInTaiwanWithTimeout(uri, selectors, 30*time.Second)
}

func CrawlByURLInTaiwanWithTimeout(
	uri string,
	selectors []SelectorRequest,
	timeout time.Duration,
) (map[string]any, error) {
	proxyURL := strings.TrimSpace(config.EnvConfig().CFWorkerProxyURL)
	secret := strings.TrimSpace(config.EnvConfig().CFWorkerProxySecret)
	if proxyURL == "" {
		return nil, fmt.Errorf("CF_WORKER_PROXY_URL is required")
	}
	if secret == "" {
		return nil, fmt.Errorf("CF_WORKER_PROXY_SECRET is required")
	}

	target, err := url.Parse(proxyURL)
	if err != nil {
		return nil, fmt.Errorf("parse CF_WORKER_PROXY_URL: %w", err)
	}
	query := target.Query()
	query.Set("url", uri)
	target.RawQuery = query.Encode()

	req, err := http.NewRequest(http.MethodGet, target.String(), nil)
	if err != nil {
		return nil, err
	}
	req.Header.Set("Authorization", "Bearer "+secret)

	client := http.Client{Timeout: timeout}
	resp, err := client.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()
	if resp.StatusCode < http.StatusOK || resp.StatusCode >= http.StatusMultipleChoices {
		return nil, fmt.Errorf("Taiwan proxy returned %s", resp.Status)
	}

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, err
	}
	return crawl(body, selectors)
}

func crawl(html []byte, selectors []SelectorRequest) (map[string]any, error) {
	var out = make(map[string]any)
	doc, docError := goquery.NewDocumentFromReader(bytes.NewReader(html))
	if docError != nil {
		return out, docError
	}

	for _, selector := range selectors {
		s := doc.Find(selector.Pattern)
		out[selector.Name] = query(s, selector)
	}
	return out, nil
}

func trimFunc(r rune) bool {
	return r == '\n' || r == '\t'
}
func replace(str string, target ...string) string {
	replaceStrings := []string{"\r", "\t", "\n"}
	if len(target) > 0 {
		replaceStrings = append(replaceStrings, target...)
	}
	for _, t := range replaceStrings {
		str = strings.Replace(str, t, "", -1)
	}
	return str
}

func query(selection *goquery.Selection, current SelectorRequest) any {
	var tmp = make([]any, 0)
	for idx, sel := range selection.EachIter() {
		if !current.Multiple && idx == 0 {
			return getValue(sel, current)
		}
		if sel.Length() == 0 {
			return nil
		}
		tmp = append(tmp, getValue(sel, current))
	}
	return tmp
}

func getValue(sel *goquery.Selection, current SelectorRequest) SelectorResponse {
	h1, _ := sel.Html()
	if current.Trim {
		h1 = replace(strings.TrimFunc(h1, trimFunc))
	}
	t1 := sel.Text()
	if current.Trim {
		t1 = replace(strings.TrimFunc(t1, trimFunc))
	}
	attrs := make(map[string]any)
	if len(current.Attrs) > 0 {
		for _, attr := range current.Attrs {
			attrs[attr] = sel.AttrOr(attr, "")
		}
	}
	children := make(map[string]any)
	if current.Children != nil {
		for _, child := range current.Children {
			s := sel.Find(child.Pattern)
			if s.Length() > 0 {
				children[child.Name] = getValue(s, child)
			}
		}
	}
	return SelectorResponse{
		Html:     &h1,
		Text:     &t1,
		Attrs:    attrs,
		Children: children,
	}
}
