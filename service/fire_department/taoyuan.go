package fire_department

import (
	"fmt"
	"strings"
	"time"

	"faryne.dev/service/crawler"
)

const taoyuanCaseListURL = "https://www.tyfd.gov.tw/cht/index.php?act=caselist"

func Taoyuan() ([]Event, error) {
	resp, err := crawler.CrawlByUrlWithTimeout(taoyuanCaseListURL, []crawler.SelectorRequest{
		{
			Name:     "cases",
			Pattern:  "div.tr",
			Multiple: true,
			Trim:     true,
			Children: []crawler.SelectorRequest{
				{
					Name:    "occurred_at",
					Pattern: "div.td:nth-child(1) date",
					Trim:    true,
				},
				{
					Name:    "type",
					Pattern: "div.td:nth-child(2)",
					Trim:    true,
				},
				{
					Name:    "sub_type",
					Pattern: "div.td:nth-child(3)",
					Trim:    true,
				},
				{
					Name:    "endpoint_info",
					Pattern: "div.td:nth-child(4)",
					Trim:    true,
				},
				{
					Name:    "cars",
					Pattern: "div.td:nth-child(5)",
					Trim:    true,
				},
				{
					Name:    "status",
					Pattern: "div.td:nth-child(6)",
					Trim:    true,
				},
			},
		},
	}, crawlerRequestTimeout)
	if err != nil {
		return nil, err
	}

	return parseTaoyuanCases(resp)
}

func parseTaoyuanCases(resp map[string]any) ([]Event, error) {
	rows, ok := resp["cases"].([]any)
	if !ok {
		return nil, fmt.Errorf("taoyuan cases response has unexpected type %T", resp["cases"])
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

		occurredAt := taoyuanChildText(caseRow, "occurred_at")
		if occurredAt == "" {
			// Header rows do not have td/date children.
			continue
		}

		t, err := time.ParseInLocation("2006-01-02 15:04", occurredAt, loc)
		if err != nil {
			return nil, fmt.Errorf("parse taoyuan occurred_at %q: %w", occurredAt, err)
		}

		eventType := stripTaoyuanFieldTitle(taoyuanChildText(caseRow, "type"), "案類")
		subType := stripTaoyuanFieldTitle(taoyuanChildText(caseRow, "sub_type"), "案別")

		events = append(events, Event{
			Type:         eventType,
			SubType:      subType,
			Title:        strings.TrimSpace(eventType + " " + subType),
			EndpointInfo: stripTaoyuanFieldTitle(taoyuanChildText(caseRow, "endpoint_info"), "發生地點"),
			Cars:         splitTaoyuanCars(stripTaoyuanFieldTitle(taoyuanChildText(caseRow, "cars"), "派遣分隊")),
			Timestamp:    t.Unix(),
		})
	}

	return events, nil
}

func taoyuanChildText(row crawler.SelectorResponse, name string) string {
	child, ok := row.Children[name].(crawler.SelectorResponse)
	if !ok || child.Text == nil {
		return ""
	}

	return strings.TrimSpace(*child.Text)
}

func stripTaoyuanFieldTitle(value string, title string) string {
	return strings.TrimSpace(strings.TrimPrefix(value, title))
}

func splitTaoyuanCars(value string) []string {
	if value == "" {
		return []string{}
	}

	parts := strings.Split(value, ",")
	cars := make([]string, 0, len(parts))
	for _, part := range parts {
		car := strings.TrimSpace(part)
		if car != "" {
			cars = append(cars, car)
		}
	}

	return cars
}
