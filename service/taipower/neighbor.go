package taipower

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"errors"
	"fmt"
	"net/http"
	"net/url"
	"regexp"
	"strconv"
	"strings"
	"sync"
	"time"

	"faryne.dev/model/entity/opendata/taipower"
	taipowerRepo "faryne.dev/repository/taipower"
	"faryne.dev/service/crawler"
	"faryne.dev/service/log"
	"go.uber.org/zap"
)

const (
	firstROCYear = 105
	// 正常 1～2 秒內回應；Worker 卡住上游時會等滿自己的 30 秒才回 502，提早放棄改重試比較快
	neighborRequestTimeout = 15 * time.Second
	neighborRequestRetries = 3
	neighborRetryDelay     = 3 * time.Second
	neighborPageDelay      = time.Second
	backfillRequestDelay   = 2 * time.Second
	fullSyncBatchSize      = 500
	neighborSaveWorkers    = 4
)

// 查詢結果狀態列，例如「查詢結果：共 210 筆，115年7月，第 1 / 7 頁，顯示第 1 至 30 筆。」
var neighborPageCountPattern = regexp.MustCompile(`第\s*\d+\s*/\s*(\d+)\s*頁`)

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

// Backfill 從 105 年 1 月補抓到上個月
func (s *NeighborService) Backfill() error {
	lastMonth := s.now().AddDate(0, -1, 0)
	return s.crawlMonths(
		time.Date(firstROCYear+1911, time.January, 1, 0, 0, 0, 0, time.Local),
		time.Date(lastMonth.Year(), lastMonth.Month(), 1, 0, 0, 0, 0, time.Local),
	)
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

	return s.crawlMonths(from, to)
}

// crawlMonths 逐月抓取 [from, to]；單月失敗只記錄並繼續往下，最後彙整所有失敗月份一起回傳
func (s *NeighborService) crawlMonths(from time.Time, to time.Time) error {
	var errs []error
	for current := from; !current.After(to); current = current.AddDate(0, 1, 0) {
		month := current.Format("2006-01")
		if count, err := s.CrawlMonth(current.Year()-1911, int(current.Month())); err != nil {
			log.Logger().Warn("Taipower neighbor month crawl failed", zap.String("month", month), zap.Error(err))
			errs = append(errs, fmt.Errorf("crawl %s: %w", month, err))
		} else {
			log.Logger().Info("Taipower neighbor month crawled", zap.String("month", month), zap.Int("items", count))
		}
		if current.Before(to) {
			time.Sleep(backfillRequestDelay)
		}
	}
	return errors.Join(errs...)
}

func (s *NeighborService) CrawlMonth(rocYear int, month int) (int, error) {
	if rocYear < firstROCYear || month < 1 || month > 12 {
		return 0, fmt.Errorf("invalid ROC year/month: %d/%d", rocYear, month)
	}

	// 台電改版後每頁 30 筆並分頁（pn 超過最末頁會停在最末頁），頁數以第一頁的查詢結果為準
	var items []taipower.Neighbor
	for page, pages := 1, 1; page <= pages; page++ {
		params := url.Values{
			"mid":   {"16"},
			"year":  {strconv.Itoa(rocYear)},
			"month": {strconv.Itoa(month)},
			"key1":  {""},
			"key2":  {""},
			"pn":    {strconv.Itoa(page)},
		}
		resp, err := fetchNeighborPage("https://service.taipower.com.tw/info/tc/inner.aspx?" + params.Encode())
		if err != nil {
			return 0, fmt.Errorf("page %d: %w", page, err)
		}
		if page == 1 {
			pages = neighborPageCount(resp)
		}
		pageItems, err := parseNeighbors(resp, rocYear+1911, month, s.now())
		if err != nil {
			return 0, fmt.Errorf("page %d: %w", page, err)
		}
		items = append(items, pageItems...)
		if page < pages {
			time.Sleep(neighborPageDelay)
		}
	}
	if err := s.saveNeighbors(items); err != nil {
		return 0, err
	}
	if err := indexNeighbors(context.Background(), items); err != nil {
		return len(items), fmt.Errorf("index ROC year %d month %d: %w", rocYear, month, err)
	}
	return len(items), nil
}

// fetchNeighborPage 抓月份頁面並重試；走 proxy 時卡住多半是 HTTP/2 連線落在境外 colo，
// 重試前關掉閒置連線，讓下一次重新 dial（可能換到落在台灣 colo 的 anycast IP）
func fetchNeighborPage(uri string) (map[string]any, error) {
	var err error
	for attempt := 1; attempt <= neighborRequestRetries; attempt++ {
		var resp map[string]any
		if resp, err = crawler.CrawlByURLInTaiwanWithTimeout(uri, neighborSelectors(), neighborRequestTimeout); err == nil {
			return resp, nil
		}
		if attempt < neighborRequestRetries {
			log.Logger().Warn("Retry Taipower neighbor page", zap.String("url", uri), zap.Int("attempt", attempt), zap.Error(err))
			http.DefaultClient.CloseIdleConnections()
			time.Sleep(neighborRetryDelay)
		}
	}
	return nil, fmt.Errorf("fetch after %d attempts: %w", neighborRequestRetries, err)
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

// neighborSelectors 對應台電改版後的 10 欄：項次、核准日期、縣市鄉鎮區、受捐助單位、活動名稱、
// 活動時間起、活動時間迄、活動地點、核准捐助金額（千元）、核准理由
func neighborSelectors() []crawler.SelectorRequest {
	return []crawler.SelectorRequest{{Name: "result", Pattern: "#result", Trim: true}, {
		Name:     "neighbors",
		Pattern:  "table tbody > tr",
		Multiple: true,
		Trim:     true,
		Children: []crawler.SelectorRequest{
			{Name: "obj_month_id", Pattern: "td:nth-child(1)", Trim: true},
			{Name: "cityarea", Pattern: "td:nth-child(3)", Trim: true},
			{Name: "unit", Pattern: "td:nth-child(4)", Trim: true},
			{Name: "summary", Pattern: "td:nth-child(5)", Trim: true},
			{Name: "cash", Pattern: "td:nth-child(9)", Trim: true},
			{Name: "apply_reason", Pattern: "td:nth-child(10)", Trim: true},
		},
	}}
}

// neighborPageCount 從查詢結果狀態列取總頁數；找不到（無資料或版面再變）時當作只有一頁
func neighborPageCount(resp map[string]any) int {
	result, ok := resp["result"].(crawler.SelectorResponse)
	if !ok || result.Text == nil {
		return 1
	}
	match := neighborPageCountPattern.FindStringSubmatch(*result.Text)
	if match == nil {
		return 1
	}
	pages, err := strconv.Atoi(match[1])
	if err != nil || pages < 1 {
		return 1
	}
	return pages
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
		cityArea = normalizeCityArea(cityArea, unit)
		if !isValidCityArea(cityArea) {
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
