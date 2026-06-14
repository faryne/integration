package taipower

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"fmt"
	"net/url"
	"strconv"
	"strings"
	"sync"
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
	neighborSaveWorkers    = 4
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

func (s *NeighborService) CrawlRange(fromValue string, toValue string) error {
	from, err := parseCrawlMonth(fromValue)
	if err != nil {
		return fmt.Errorf("from: %w", err)
	}

	var to time.Time
	if strings.TrimSpace(toValue) == "" {
		lastMonth := s.now().AddDate(0, -1, 0)
		to = time.Date(lastMonth.Year(), lastMonth.Month(), 1, 0, 0, 0, 0, time.Local)
	} else {
		to, err = parseCrawlMonth(toValue)
		if err != nil {
			return fmt.Errorf("to: %w", err)
		}
	}
	if from.After(to) {
		return fmt.Errorf("from must not be later than to")
	}

	for current := from; !current.After(to); current = current.AddDate(0, 1, 0) {
		rocYear := current.Year() - 1911
		if _, err := s.CrawlMonth(rocYear, int(current.Month())); err != nil {
			return fmt.Errorf("crawl %s: %w", current.Format("2006-01"), err)
		}
		if current.Before(to) {
			time.Sleep(backfillRequestDelay)
		}
	}
	return nil
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

	items, err := parseNeighbors(resp, rocYear+1911, month, s.now())
	if err != nil {
		return 0, err
	}
	if err := s.saveNeighbors(items); err != nil {
		return 0, err
	}
	if err := indexNeighbors(context.Background(), items); err != nil {
		return len(items), fmt.Errorf("index ROC year %d month %d: %w", rocYear, month, err)
	}
	return len(items), nil
}

func parseCrawlMonth(value string) (time.Time, error) {
	value = strings.TrimSpace(value)
	if value == "" {
		return time.Time{}, fmt.Errorf("is required")
	}
	month, err := time.ParseInLocation("2006-01", value, time.Local)
	if err != nil {
		return time.Time{}, fmt.Errorf("must use YYYY-MM format")
	}
	if month.Year()-1911 < firstROCYear {
		return time.Time{}, fmt.Errorf("must not be earlier than %d-01", firstROCYear+1911)
	}
	return month, nil
}

func (s *NeighborService) saveNeighbors(items []taipower.Neighbor) error {
	type saveJob struct {
		item *taipower.Neighbor
	}

	jobs := make(chan saveJob)
	errs := make(chan error, len(items))
	var workers sync.WaitGroup
	workerCount := min(neighborSaveWorkers, len(items))
	for range workerCount {
		workers.Add(1)
		go func() {
			defer workers.Done()
			for job := range jobs {
				if err := s.repo.Upsert(job.item); err != nil {
					errs <- fmt.Errorf("save item %d: %w", job.item.ObjMonthID, err)
				}
			}
		}()
	}

	for i := range items {
		jobs <- saveJob{item: &items[i]}
	}
	close(jobs)
	workers.Wait()
	close(errs)

	for err := range errs {
		return err
	}
	return nil
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

func parseNeighbors(resp map[string]any, year int, month int, now time.Time) ([]taipower.Neighbor, error) {
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
			ObjYear:     year,
			ObjMonth:    month,
			CreatedOn:   now,
		}
		item.DuplicateHash = neighborDuplicateHash(item)
		items = append(items, item)
	}
	return items, nil
}

func neighborDuplicateHash(item taipower.Neighbor) string {
	value := strings.Join([]string{
		strconv.Itoa(item.ObjYear),
		strconv.Itoa(item.ObjMonth),
		item.CityArea,
		item.Unit,
		item.Summary,
		strconv.FormatFloat(item.Cash, 'f', 6, 64),
	}, "\x1f")
	sum := sha256.Sum256([]byte(value))
	return hex.EncodeToString(sum[:])
}

func neighborText(row crawler.SelectorResponse, name string) string {
	child, ok := row.Children[name].(crawler.SelectorResponse)
	if !ok || child.Text == nil {
		return ""
	}
	return strings.TrimSpace(*child.Text)
}
