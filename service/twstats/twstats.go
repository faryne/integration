package twstats

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"net/url"
	"sort"
	"strconv"
	"strings"
	"sync/atomic"
	"time"

	model "faryne.dev/model/entity/opendata/twstats"
)

const (
	// rawBaseURL 只用來組給使用者的原始資料連結，資料本身一律從資料方塊讀
	rawBaseURL     = "https://raw.githubusercontent.com/faryne/tw-stats/master/docs"
	defaultPerPage = 30
	maxPerPage     = 100
)

type Area = model.Area

// areas 的順序即資料方塊的欄位順序：第 0 欄是全國彙總「台灣」，其後 22 縣市
var areas = []Area{
	{Code: "Taiwan", Name: "台灣"},
	{Code: "NewTaipei", Name: "新北市"},
	{Code: "Taipei", Name: "台北市"},
	{Code: "Taoyuan", Name: "桃園市"},
	{Code: "Taichung", Name: "台中市"},
	{Code: "Tainan", Name: "台南市"},
	{Code: "Kaohsiung", Name: "高雄市"},
	{Code: "Ilan", Name: "宜蘭縣"},
	{Code: "HsinchuCounty", Name: "新竹縣"},
	{Code: "Miaoli", Name: "苗栗縣"},
	{Code: "Changhwa", Name: "彰化縣"},
	{Code: "Nantou", Name: "南投縣"},
	{Code: "Yunlin", Name: "雲林縣"},
	{Code: "ChiaYiCounty", Name: "嘉義縣"},
	{Code: "Pingtung", Name: "屏東縣"},
	{Code: "Taitung", Name: "臺東縣"},
	{Code: "Hualien", Name: "花蓮縣"},
	{Code: "Penghu", Name: "澎湖縣"},
	{Code: "Keelung", Name: "基隆市"},
	{Code: "HsinchuCity", Name: "新竹市"},
	{Code: "ChiaYiCity", Name: "嘉義市"},
	{Code: "Kinmen", Name: "金門縣"},
	{Code: "Matsu", Name: "連江縣"},
}

type Indicator struct {
	Key       string `json:"key"`
	Name      string `json:"name"`
	PageURL   string `json:"page_url"`
	SourceURL string `json:"source_url"`
}

type SearchResult struct {
	Total   int         `json:"total"`
	Page    int         `json:"page"`
	PerPage int         `json:"per_page"`
	Data    []Indicator `json:"data"`
}

type RetrieveRequest struct {
	Name      string
	StartYear int
	EndYear   int
	Years     []int
	Areas     []string
}

type YearData struct {
	Year   int               `json:"year"`
	Total  string            `json:"total,omitempty"`
	Values map[string]string `json:"values"`
}

type RetrieveResult struct {
	Name        string            `json:"name"`
	Unit        string            `json:"unit,omitempty"`
	Explanation string            `json:"explanation,omitempty"`
	Areas       map[string]string `json:"areas"`
	Data        []YearData        `json:"data"`
	PageURL     string            `json:"page_url"`
	SourceURL   string            `json:"source_url"`
}

type Service struct {
	tarballURL string
	client     *http.Client
	cube       atomic.Pointer[Cube]
}

// Default 全站共用的實例：API、MCP 與排程讀寫同一份資料方塊
var Default = NewService()

func NewService() *Service {
	return &Service{tarballURL: defaultTarballURL, client: &http.Client{Timeout: time.Minute}}
}

// Search 依照網站相同規則比對指標 key 與名稱，並限制單次 MCP 回應大小。
func (s *Service) Search(ctx context.Context, keyword string, page, perPage int) (*SearchResult, error) {
	page, perPage, err := normalizePagination(page, perPage)
	if err != nil {
		return nil, err
	}
	cube, err := s.loadedCube()
	if err != nil {
		return nil, err
	}

	normalizedKeyword := strings.ToLower(strings.TrimSpace(keyword))
	rows := make([]Indicator, 0, len(cube.indicators))
	for _, data := range cube.indicators {
		if normalizedKeyword != "" && !strings.Contains(strings.ToLower(data.Key), normalizedKeyword) && !strings.Contains(strings.ToLower(data.Name), normalizedKeyword) {
			continue
		}
		rows = append(rows, indicator(data.Key, data.Name))
	}
	sort.Slice(rows, func(i, j int) bool { return rows[i].Name < rows[j].Name })

	total := len(rows)
	start := min((page-1)*perPage, total)
	end := min(start+perPage, total)
	return &SearchResult{Total: total, Page: page, PerPage: perPage, Data: rows[start:end]}, nil
}

// Retrieve 讀取單一指標，年份與區域皆省略時回傳網站可顯示的完整資料。
func (s *Service) Retrieve(ctx context.Context, input RetrieveRequest) (*RetrieveResult, error) {
	input.Name = strings.TrimSpace(input.Name)
	if input.Name == "" {
		return nil, fmt.Errorf("name is required")
	}
	if input.StartYear > 0 && input.EndYear > 0 && input.StartYear > input.EndYear {
		return nil, fmt.Errorf("start_year must not be later than end_year")
	}
	selectedAreas, err := resolveAreas(input.Areas)
	if err != nil {
		return nil, err
	}

	cube, err := s.loadedCube()
	if err != nil {
		return nil, err
	}
	data, ok := cube.byName[input.Name]
	if !ok {
		return nil, ErrIndicatorNotFound
	}
	selectedYears := make(map[int]struct{}, len(input.Years))
	for _, year := range input.Years {
		selectedYears[year] = struct{}{}
	}

	ref := indicator(data.Key, data.Name)
	result := &RetrieveResult{
		Name: data.Name, Unit: data.Unit, Explanation: data.Explain,
		Areas: make(map[string]string, len(selectedAreas)), Data: make([]YearData, 0, len(data.Years)),
		PageURL: ref.PageURL, SourceURL: ref.SourceURL,
	}
	for _, area := range selectedAreas {
		result.Areas[area.Code] = area.Name
	}
	for _, year := range data.Years {
		if input.StartYear > 0 && year < input.StartYear || input.EndYear > 0 && year > input.EndYear {
			continue
		}
		if _, ok := selectedYears[year]; len(selectedYears) > 0 && !ok {
			continue
		}
		values := make(map[string]string, len(selectedAreas))
		for _, area := range selectedAreas {
			values[area.Code] = formatNumber(data.value(year, columnOf(area.Code)))
		}
		result.Data = append(result.Data, YearData{Year: year, Total: formatNumber(data.value(year, totalColumn)), Values: values})
	}
	return result, nil
}

// formatNumber 無資料時沿用原始資料的「-」
func formatNumber(value float64, ok bool) string {
	if !ok {
		return "-"
	}
	return strconv.FormatFloat(value, 'f', -1, 64)
}

// columnOf 區域代碼在資料方塊中的欄位；代碼一律先經 resolveAreas 驗證，找不到時回傳 -1
func columnOf(code string) int {
	for i, area := range areas {
		if area.Code == code {
			return i
		}
	}
	return -1
}

func normalizePagination(page, perPage int) (int, int, error) {
	if page < 0 {
		return 0, 0, fmt.Errorf("page must be greater than 0")
	}
	if perPage < 0 || perPage > maxPerPage {
		return 0, 0, fmt.Errorf("per_page must be between 1 and %d", maxPerPage)
	}
	if page == 0 {
		page = 1
	}
	if perPage == 0 {
		perPage = defaultPerPage
	}
	return page, perPage, nil
}

func resolveAreas(values []string) ([]Area, error) {
	if len(values) == 0 {
		return areas, nil
	}
	resolved := make([]Area, 0, len(values))
	seen := make(map[string]struct{}, len(values))
	for _, value := range values {
		value = strings.TrimSpace(value)
		var matched *Area
		for i := range areas {
			if strings.EqualFold(value, areas[i].Code) || value == areas[i].Name || value == "台東縣" && areas[i].Code == "Taitung" {
				matched = &areas[i]
				break
			}
		}
		if matched == nil {
			return nil, fmt.Errorf("unsupported area: %s", value)
		}
		if _, ok := seen[matched.Code]; ok {
			continue
		}
		seen[matched.Code] = struct{}{}
		resolved = append(resolved, *matched)
	}
	return resolved, nil
}

func indicator(key, name string) Indicator {
	escaped := url.PathEscape(name)
	return Indicator{
		Key: key, Name: name,
		PageURL: "https://faryne.dev/data/tw-stats/" + escaped, SourceURL: rawBaseURL + "/" + escaped + "/index.json",
	}
}

func stringValue(value any, fallback string) string {
	switch value := value.(type) {
	case string:
		return value
	case json.Number:
		return value.String()
	case nil:
		return fallback
	default:
		return fmt.Sprint(value)
	}
}
