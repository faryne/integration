package taipower

import (
	"context"
	"fmt"
	"net/url"
	"strconv"
	"strings"
	"time"

	"faryne.dev/model/entity/opendata/taipower"
	taipowerRepo "faryne.dev/repository/taipower"
	"faryne.dev/service/crawler"
)

const (
	firstROCYear           = 105
	neighborRequestTimeout = 30 * time.Second
	backfillRequestDelay   = 2 * time.Second
	fullSyncBatchSize      = 500
)

type NeighborService struct {
	repo *taipowerRepo.NeighborRepository
	now  func() time.Time
}

func NewNeighborService() *NeighborService {
	return &NeighborService{
		repo: taipowerRepo.NewNeighborRepository(),
		now:  time.Now,
	}
}

func (s *NeighborService) Backfill() error {
	lastMonth := s.now().AddDate(0, -1, 0)
	endROCYear := lastMonth.Year() - 1911
	for year := firstROCYear; year <= endROCYear; year++ {
		endMonth := 12
		if year == endROCYear {
			endMonth = int(lastMonth.Month())
		}
		for month := 1; month <= endMonth; month++ {
			if _, err := s.CrawlMonth(year, month); err != nil {
				return fmt.Errorf("crawl ROC year %d month %d: %w", year, month, err)
			}
			if year != endROCYear || month != endMonth {
				time.Sleep(backfillRequestDelay)
			}
		}
	}
	return nil
}

func (s *NeighborService) CrawlPreviousMonth() (int, error) {
	lastMonth := s.now().AddDate(0, -1, 0)
	return s.CrawlMonth(lastMonth.Year()-1911, int(lastMonth.Month()))
}

func (s *NeighborService) CrawlMonth(rocYear int, month int) (int, error) {
	if rocYear < firstROCYear || month < 1 || month > 12 {
		return 0, fmt.Errorf("invalid ROC year/month: %d/%d", rocYear, month)
	}

	params := url.Values{
		"mid":   {"16"},
		"year":  {strconv.Itoa(rocYear)},
		"month": {strconv.Itoa(month)},
		"key1":  {""},
		"key2":  {""},
	}
	uri := "https://service.taipower.com.tw/info/tc/inner.aspx?" + params.Encode()
	resp, err := crawler.CrawlByURLInTaiwanWithTimeout(uri, neighborSelectors(), neighborRequestTimeout)
	if err != nil {
		return 0, err
	}

	items, err := parseNeighbors(resp, rocYear, month, s.now())
	if err != nil {
		return 0, err
	}
	for i := range items {
		if err := s.repo.Upsert(&items[i]); err != nil {
			return i, fmt.Errorf("save item %d: %w", items[i].ObjMonthID, err)
		}
	}
	if err := indexNeighbors(context.Background(), items); err != nil {
		return len(items), fmt.Errorf("index ROC year %d month %d: %w", rocYear, month, err)
	}
	return len(items), nil
}

func (s *NeighborService) SyncAllToElasticsearch() error {
	var afterID uint
	for {
		items, err := s.repo.GetBatch(afterID, fullSyncBatchSize)
		if err != nil {
			return err
		}
		if len(items) == 0 {
			return nil
		}
		if err := indexNeighbors(context.Background(), items); err != nil {
			return fmt.Errorf("index batch after id %d: %w", afterID, err)
		}
		afterID = items[len(items)-1].ID
	}
}

func neighborSelectors() []crawler.SelectorRequest {
	return []crawler.SelectorRequest{{
		Name:     "neighbors",
		Pattern:  "table tbody > tr",
		Multiple: true,
		Trim:     true,
		Children: []crawler.SelectorRequest{
			{Name: "obj_month_id", Pattern: "td:nth-child(1)", Trim: true},
			{Name: "cityarea", Pattern: "td:nth-child(4)", Trim: true},
			{Name: "unit", Pattern: "td:nth-child(5)", Trim: true},
			{Name: "summary", Pattern: "td:nth-child(6)", Trim: true},
			{Name: "cash", Pattern: "td:nth-child(10)", Trim: true},
			{Name: "apply_reason", Pattern: "td:nth-child(11)", Trim: true},
		},
	}}
}

func parseNeighbors(resp map[string]any, rocYear int, month int, now time.Time) ([]taipower.Neighbor, error) {
	rows, ok := resp["neighbors"].([]any)
	if !ok {
		return nil, fmt.Errorf("neighbors response has unexpected type %T", resp["neighbors"])
	}

	items := make([]taipower.Neighbor, 0, len(rows))
	for _, row := range rows {
		data, ok := row.(crawler.SelectorResponse)
		if !ok {
			continue
		}
		id, err := strconv.Atoi(neighborText(data, "obj_month_id"))
		if err != nil {
			continue
		}
		cityArea := neighborText(data, "cityarea")
		unit := neighborText(data, "unit")
		summary := neighborText(data, "summary")
		if cityArea == "" || unit == "" || summary == "" {
			continue
		}
		cash, err := strconv.ParseFloat(strings.ReplaceAll(neighborText(data, "cash"), ",", ""), 64)
		if err != nil {
			return nil, fmt.Errorf("parse cash for item %d: %w", id, err)
		}
		item := taipower.Neighbor{
			ObjMonthID:  id,
			CityArea:    cityArea,
			Unit:        unit,
			Summary:     summary,
			ApplyReason: neighborText(data, "apply_reason"),
			Cash:        cash,
			ObjYear:     rocYear,
			ObjMonth:    month,
			CreatedOn:   now,
		}
		items = append(items, item)
	}
	return items, nil
}

func neighborText(row crawler.SelectorResponse, name string) string {
	child, ok := row.Children[name].(crawler.SelectorResponse)
	if !ok || child.Text == nil {
		return ""
	}
	return strings.TrimSpace(*child.Text)
}
