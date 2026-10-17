package mediaworker

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"regexp"
	"strconv"
	"strings"
)

const (
	pixaiWebURL        = "https://pixai.art"
	pixaiFavoriteModel = "favorite_models"
	pixaiFavoriteLoRA  = "favorite_loras"
	pixaiMaxPageSize   = 8 << 20
)

// pixaiModelURL 接受 pixai.art/[語系/]model/<modelId>[/<versionId>]；單一版本的模型頁網址不會帶 versionId。
var pixaiModelURL = regexp.MustCompile(`^https?://(?:www\.)?pixai\.art/(?:[A-Za-z]{2}(?:-[A-Za-z]+)?/)?model/(\d+)(?:/(\d+))?/?(?:[?#].*)?$`)

// pixaiStreamPayload 是公開模型頁 SSR 時塞進 HTML 的 React Router turbo-stream 資料。
var pixaiStreamPayload = regexp.MustCompile(`(?s)streamController\.enqueue\(("(?:[^"\\]|\\.)*")\)`)

// pixaiPageModel 是從公開模型頁讀到的模型摘要。
type pixaiPageModel struct {
	Title, Type, LatestVersionID string
}

// ResolveCatalogItem 把作者貼的 PixAI 網址解析成常用清單的一項。
// 名稱、類型與「最新可用版本」來自公開模型頁（不需登入）；這是 PixAI 網站內部格式、沒有公開文件，
// 讀不到時：網址有版本就用預設名稱照樣加入，沒有版本才擋下。
func (a pixaiAdapter) ResolveCatalogItem(ctx context.Context, fieldKey, rawURL string) (CatalogItem, error) {
	match := pixaiModelURL.FindStringSubmatch(rawURL)
	if match == nil {
		return CatalogItem{}, errors.New("請貼上 pixai.art 的模型網址")
	}
	wantLoRA := fieldKey == pixaiFavoriteLoRA
	page, pageErr := a.modelPage(ctx, match[1])
	if pageErr == nil && page.Type != "" && strings.Contains(page.Type, "LORA") != wantLoRA {
		if wantLoRA {
			return CatalogItem{}, errors.New("這是主模型，請貼到「常用模型」")
		}
		return CatalogItem{}, errors.New("這是 LoRA，請貼到「常用 LoRA」")
	}
	versionID := match[2]
	if versionID == "" {
		versionID = page.LatestVersionID
	}
	if versionID == "" {
		return CatalogItem{}, errors.New("無法從這個頁面取得版本，請改貼有版本的網址")
	}
	item := CatalogItem{ID: versionID, Name: page.Title}
	if item.Name == "" {
		item.Name = map[bool]string{false: "模型 ", true: "LoRA "}[wantLoRA] + versionID[max(0, len(versionID)-6):]
	}
	if wantLoRA {
		item.Weight = 1
	}
	return item, nil
}

// modelPage 讀取公開模型頁並解析模型摘要；只做 GET，不帶 API key。
func (a pixaiAdapter) modelPage(ctx context.Context, modelID string) (pixaiPageModel, error) {
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, a.webURL+"/model/"+modelID, nil)
	if err != nil {
		return pixaiPageModel{}, err
	}
	// 預設的 Go User-Agent 可能被當成爬蟲擋下，改用一般瀏覽器字串。
	req.Header.Set("User-Agent", "Mozilla/5.0 (SteamLoom Writer)")
	response, err := a.client.Do(req)
	if err != nil {
		return pixaiPageModel{}, err
	}
	defer response.Body.Close()
	if response.StatusCode != http.StatusOK {
		return pixaiPageModel{}, fmt.Errorf("PixAI 模型頁回傳 HTTP %d", response.StatusCode)
	}
	body, err := io.ReadAll(io.LimitReader(response.Body, pixaiMaxPageSize))
	if err != nil {
		return pixaiPageModel{}, err
	}
	return parsePixAIModelPage(body, modelID)
}

// parsePixAIModelPage 解開 turbo-stream：資料是一個扁平陣列，物件寫成 {"_<key 的索引>": <值的索引>}，負數代表 null／undefined。
// 找出 __typename 為 GenerationModel 且 id 相符的物件，讀 title、type、latestAvailableVersion.id。
func parsePixAIModelPage(body []byte, modelID string) (pixaiPageModel, error) {
	match := pixaiStreamPayload.FindSubmatch(body)
	if match == nil {
		return pixaiPageModel{}, errors.New("PixAI 模型頁沒有可解析的資料")
	}
	var stream string
	if err := json.Unmarshal(match[1], &stream); err != nil {
		return pixaiPageModel{}, err
	}
	var data []any
	if err := json.Unmarshal([]byte(strings.SplitN(stream, "\n", 2)[0]), &data); err != nil {
		return pixaiPageModel{}, err
	}
	get := func(object map[string]any, name string) any {
		for key, ref := range object {
			keyIndex, err := strconv.Atoi(strings.TrimPrefix(key, "_"))
			valueIndex, ok := ref.(float64)
			if err != nil || !ok || keyIndex < 0 || keyIndex >= len(data) || data[keyIndex] != name {
				continue
			}
			if valueIndex < 0 || int(valueIndex) >= len(data) {
				return nil
			}
			return data[int(valueIndex)]
		}
		return nil
	}
	text := func(value any) string { result, _ := value.(string); return result }
	for _, value := range data {
		object, ok := value.(map[string]any)
		if !ok || text(get(object, "__typename")) != "GenerationModel" || text(get(object, "id")) != modelID {
			continue
		}
		model := pixaiPageModel{Title: strings.TrimSpace(text(get(object, "title"))), Type: text(get(object, "type"))}
		if latest, ok := get(object, "latestAvailableVersion").(map[string]any); ok {
			model.LatestVersionID = text(get(latest, "id"))
		}
		return model, nil
	}
	return pixaiPageModel{}, errors.New("PixAI 模型頁找不到這個模型")
}

// pixaiFavorites 讀取常用清單設定；格式錯誤時當成空清單（Save 時已驗證過）。
func pixaiFavorites(settings map[string]string, key string) []CatalogItem {
	items, err := parseCatalog(settings[key])
	if err != nil {
		return nil
	}
	return items
}
