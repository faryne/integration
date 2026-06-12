package fire_department

import (
	"fmt"
	"strings"
	"time"

	"faryne.dev/service/crawler"
)

type dataTableCaseConfig struct {
	Source        string
	URL           string
	CaseIDColumn  int
	TimeColumn    int
	TypeColumn    int
	SubTypeColumn int
	AddressColumn int
	CarsColumn    int
	StatusColumn  int
	Crawl         func(string, []crawler.SelectorRequest, time.Duration) (map[string]any, error)
}

func crawlDataTableCases(config dataTableCaseConfig) ([]Event, error) {
	crawlFunc := config.Crawl
	if crawlFunc == nil {
		crawlFunc = crawler.CrawlByUrlWithTimeout
	}

	resp, err := crawlFunc(config.URL, []crawler.SelectorRequest{
		{
			Name:     "cases",
			Pattern:  "#dataTable tr",
			Multiple: true,
			Trim:     true,
			Children: dataTableSelectorChildren(config),
		},
	}, crawlerRequestTimeout)
	if err != nil {
		return nil, err
	}

	return parseDataTableCases(resp, config)
}

func dataTableSelectorChildren(config dataTableCaseConfig) []crawler.SelectorRequest {
	columns := map[string]int{
		"case_id":       config.CaseIDColumn,
		"occurred_at":   config.TimeColumn,
		"type":          config.TypeColumn,
		"sub_type":      config.SubTypeColumn,
		"endpoint_info": config.AddressColumn,
		"cars":          config.CarsColumn,
		"status":        config.StatusColumn,
	}

	children := make([]crawler.SelectorRequest, 0, len(columns))
	for name, column := range columns {
		if column <= 0 {
			continue
		}

		children = append(children, crawler.SelectorRequest{
			Name:    name,
			Pattern: fmt.Sprintf("td:nth-child(%d)", column),
			Trim:    true,
		})
	}

	return children
}

func parseDataTableCases(resp map[string]any, config dataTableCaseConfig) ([]Event, error) {
	rows, ok := resp["cases"].([]any)
	if !ok {
		return nil, fmt.Errorf("%s cases response has unexpected type %T", config.Source, resp["cases"])
	}

	loc, err := time.LoadLocation("Asia/Taipei")
	if err != nil {
		return nil, err
	}

	events := make([]Event, 0, len(rows))
	for _, row := range rows {
		caseRow, ok := row.(crawler.SelectorResponse)
		if !ok {
			continue
		}

		occurredAt := dataTableChildText(caseRow, "occurred_at")
		if occurredAt == "" {
			continue
		}

		t, err := time.ParseInLocation("2006/01/02 15:04:05", occurredAt, loc)
		if err != nil {
			continue
		}

		eventType := dataTableChildText(caseRow, "type")
		subType := firstNonEmpty(
			dataTableChildText(caseRow, "sub_type"),
			dataTableChildText(caseRow, "status"),
		)

		events = append(events, Event{
			Type:         eventType,
			SubType:      subType,
			Title:        dataTableTitle(eventType, dataTableChildText(caseRow, "case_id")),
			EndpointInfo: dataTableChildText(caseRow, "endpoint_info"),
			Cars:         splitDelimitedList(dataTableChildText(caseRow, "cars")),
			Timestamp:    t.Unix(),
		})
	}

	return events, nil
}

func dataTableChildText(row crawler.SelectorResponse, name string) string {
	child, ok := row.Children[name].(crawler.SelectorResponse)
	if !ok || child.Text == nil {
		return ""
	}

	return strings.TrimSpace(*child.Text)
}

func dataTableTitle(eventType string, caseID string) string {
	if caseID == "" {
		return eventType
	}

	return strings.TrimSpace(eventType + " " + caseID)
}

func firstNonEmpty(values ...string) string {
	for _, value := range values {
		if value != "" {
			return value
		}
	}

	return ""
}

func splitDelimitedList(value string) []string {
	if value == "" {
		return []string{}
	}

	parts := strings.FieldsFunc(value, func(r rune) bool {
		return r == ',' || r == '，' || r == '、'
	})
	items := make([]string, 0, len(parts))
	for _, part := range parts {
		item := strings.TrimSpace(part)
		if item != "" {
			items = append(items, item)
		}
	}

	return items
}
