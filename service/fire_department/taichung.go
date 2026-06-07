package fire_department

import (
	"fmt"
	"strings"
	"time"

	"faryne.dev/service/crawler"
)

const taichungCaseListURL = "https://www.fire.taichung.gov.tw/"

func Taichung() ([]Event, error) {
	resp, err := crawler.CrawlByUrl(taichungCaseListURL, []crawler.SelectorRequest{
		{
			Name:     "cases",
			Pattern:  "ul li:not(.timely_head)",
			Multiple: true,
			Trim:     true,
			Children: []crawler.SelectorRequest{
				{
					Name:    "occurred_at",
					Pattern: "span:nth-child(1)",
					Trim:    true,
				},
				{
					Name:    "type",
					Pattern: "span:nth-child(2)",
					Trim:    true,
				},
				{
					Name:    "endpoint_info",
					Pattern: "span:nth-child(3)",
					Trim:    true,
				},
				{
					Name:    "status",
					Pattern: "span:nth-child(4)",
					Trim:    true,
				},
			},
		},
	})
	if err != nil {
		return nil, err
	}

	return parseTaichungCases(resp)
}

func parseTaichungCases(resp map[string]any) ([]Event, error) {
	rows, ok := resp["cases"].([]any)
	if !ok {
		return nil, fmt.Errorf("taichung cases response has unexpected type %T", resp["cases"])
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

		occurredAt := taichungChildText(caseRow, "occurred_at")
		if occurredAt == "" || occurredAt == "受理時間" {
			continue
		}

		t, err := time.ParseInLocation("2006/01/02 15:04:05", occurredAt, loc)
		if err != nil {
			continue
		}

		eventType := taichungChildText(caseRow, "type")
		status := taichungChildText(caseRow, "status")

		events = append(events, Event{
			Type:         eventType,
			SubType:      status,
			Title:        strings.TrimSpace(eventType + " " + status),
			EndpointInfo: taichungChildText(caseRow, "endpoint_info"),
			Cars:         []string{},
			Timestamp:    t.Unix(),
		})
	}

	return events, nil
}

func taichungChildText(row crawler.SelectorResponse, name string) string {
	child, ok := row.Children[name].(crawler.SelectorResponse)
	if !ok || child.Text == nil {
		return ""
	}

	return strings.TrimSpace(*child.Text)
}
