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
	"time"
)

const (
	defaultBaseURL = "https://raw.githubusercontent.com/faryne/tw-stats/master/docs"
	defaultPerPage = 30
	maxPerPage     = 100
)

type Area struct {
	Code string `json:"code"`
	Name string `json:"name"`
}

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
	baseURL string
	client  *http.Client
}

func NewService() *Service {
	return &Service{baseURL: defaultBaseURL, client: &http.Client{Timeout: 15 * time.Second}}
}

// Search 依照網站相同規則比對指標 key 與名稱，並限制單次 MCP 回應大小。
func (s *Service) Search(ctx context.Context, keyword string, page, perPage int) (*SearchResult, error) {
	page, perPage, err := normalizePagination(page, perPage)
	if err != nil {
		return nil, err
	}
	index := make(map[string]string)
	if err := s.getJSON(ctx, "index.json", &index); err != nil {
		return nil, err
	}

	normalizedKeyword := strings.ToLower(strings.TrimSpace(keyword))
	rows := make([]Indicator, 0, len(index))
	for key, name := range index {
		if normalizedKeyword != "" && !strings.Contains(strings.ToLower(key), normalizedKeyword) && !strings.Contains(strings.ToLower(name), normalizedKeyword) {
			continue
		}
		rows = append(rows, indicator(s.baseURL, key, name))
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

	raw := make(map[string]map[string]any)
	path := url.PathEscape(input.Name) + "/index.json"
	if err := s.getJSON(ctx, path, &raw); err != nil {
		return nil, err
	}
	selectedYears := make(map[int]struct{}, len(input.Years))
	for _, year := range input.Years {
		selectedYears[year] = struct{}{}
	}
	years := make([]int, 0, len(raw))
	for value := range raw {
		year, err := strconv.Atoi(value)
		if err != nil || input.StartYear > 0 && year < input.StartYear || input.EndYear > 0 && year > input.EndYear {
			continue
		}
		if _, ok := selectedYears[year]; len(selectedYears) > 0 && !ok {
			continue
		}
		years = append(years, year)
	}
	sort.Ints(years)

	result := &RetrieveResult{
		Name: input.Name, Areas: make(map[string]string, len(selectedAreas)), Data: make([]YearData, 0, len(years)),
		PageURL: "https://faryne.dev/data/tw-stats/" + url.PathEscape(input.Name), SourceURL: s.baseURL + "/" + path,
	}
	for _, area := range selectedAreas {
		result.Areas[area.Code] = area.Name
	}
	for _, year := range years {
		row := raw[strconv.Itoa(year)]
		if len(result.Data) == 0 {
			result.Name = stringValue(row["Name"], input.Name)
			result.Unit = stringValue(row["Unit"], "")
			result.Explanation = stringValue(row["Explain"], "")
		}
		values := make(map[string]string, len(selectedAreas))
		for _, area := range selectedAreas {
			values[area.Code] = stringValue(row[area.Code], "")
		}
		result.Data = append(result.Data, YearData{Year: year, Total: stringValue(row["Total"], ""), Values: values})
	}
	return result, nil
}

func (s *Service) getJSON(ctx context.Context, path string, out interface{}) error {
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, strings.TrimRight(s.baseURL, "/")+"/"+path, nil)
	if err != nil {
		return err
	}
	req.Header.Set("Accept", "application/json")
	resp, err := s.client.Do(req)
	if err != nil {
		return fmt.Errorf("fetch Taiwan stats: %w", err)
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		return fmt.Errorf("fetch Taiwan stats: status %d", resp.StatusCode)
	}
	decoder := json.NewDecoder(resp.Body)
	decoder.UseNumber()
	if err := decoder.Decode(out); err != nil {
		return fmt.Errorf("decode Taiwan stats: %w", err)
	}
	return nil
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

func indicator(baseURL, key, name string) Indicator {
	escaped := url.PathEscape(name)
	return Indicator{
		Key: key, Name: name,
		PageURL: "https://faryne.dev/data/tw-stats/" + escaped, SourceURL: strings.TrimRight(baseURL, "/") + "/" + escaped + "/index.json",
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
