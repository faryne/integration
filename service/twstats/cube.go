package twstats

import (
	"archive/tar"
	"compress/gzip"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"math"
	"net/http"
	"sort"
	"strconv"
	"strings"
	"time"

	"faryne.dev/service/log"
)

// 資料方塊：tw-stats 全部指標 × 年份 × 區域的記憶體快照。
// 整個 repo 打包下載約 4.4MB、一次請求即可取得全部指標，解析成 float64 後常駐約 3～5MB，
// 比放 Redis 省一層序列化，也不必為了縣市健檢每次從 Redis 拉整份資料。
const (
	defaultTarballURL = "https://codeload.github.com/faryne/tw-stats/tar.gz/refs/heads/master"
	cubeMaxAge        = 24 * time.Hour
	totalColumn       = 23 // 前 23 欄依 areas 順序，最後一欄放原始資料的 Total
	columnCount       = totalColumn + 1
	perCapitaBase     = 10000
)

// ErrNotReady 資料方塊尚未載入（剛啟動或 GitHub 暫時抓不到），controller 轉成 503
var ErrNotReady = errors.New("tw-stats 資料尚未載入，請稍後再試")

// ErrIndicatorNotFound 指標名稱不存在，controller 轉成 404
var ErrIndicatorNotFound = errors.New("找不到此指標")

type row [columnCount]float64 // NaN 代表無資料

type indicatorData struct {
	Key, Name, Unit, Explain, Category string
	PerCapita                          bool
	Years                              []int // 由小到大
	Rows                               map[int]*row
}

type Cube struct {
	indicators []*indicatorData // 依 key 排序
	byName     map[string]*indicatorData
	population *indicatorData
	latestYear int // 多數指標的最新年份，變化榜的預設年份
	LoadedAt   time.Time
}

// EnsureFresh 資料方塊尚未載入或超過 24 小時才重抓；啟動與每小時排程共用，也兼做失敗重試
func (s *Service) EnsureFresh(ctx context.Context) error {
	if c := s.cube.Load(); c != nil && time.Since(c.LoadedAt) < cubeMaxAge {
		return nil
	}
	return s.Refresh(ctx)
}

// Refresh 下載整個 tw-stats repo 打包檔並重建資料方塊，成功後才整份替換，失敗時保留舊資料
func (s *Service) Refresh(ctx context.Context) error {
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, s.tarballURL, nil)
	if err != nil {
		return err
	}
	resp, err := s.client.Do(req)
	if err != nil {
		return fmt.Errorf("download tw-stats tarball: %w", err)
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		return fmt.Errorf("download tw-stats tarball: status %d", resp.StatusCode)
	}
	cube, err := readTarball(resp.Body)
	if err != nil {
		return err
	}
	s.cube.Store(cube)
	log.Logger().Info(fmt.Sprintf("tw-stats cube loaded: %d indicators, latest year %d", len(cube.indicators), cube.latestYear))
	return nil
}

func (s *Service) loadedCube() (*Cube, error) {
	if c := s.cube.Load(); c != nil {
		return c, nil
	}
	return nil, ErrNotReady
}

// readTarball 逐檔串流解析，只讀 docs/index.json 與 docs/<名稱>/index.json，逐年檔與程式碼一律跳過
func readTarball(r io.Reader) (*Cube, error) {
	gz, err := gzip.NewReader(r)
	if err != nil {
		return nil, fmt.Errorf("read tw-stats tarball: %w", err)
	}
	defer gz.Close()

	var index map[string]string
	parsed := make(map[string]*indicatorData)
	tr := tar.NewReader(gz)
	for {
		header, err := tr.Next()
		if errors.Is(err, io.EOF) {
			break
		}
		if err != nil {
			return nil, fmt.Errorf("read tw-stats tarball: %w", err)
		}
		// 路徑格式：<repo>-<branch>/docs/<名稱>/index.json
		parts := strings.Split(header.Name, "/")
		switch {
		case len(parts) == 3 && parts[1] == "docs" && parts[2] == "index.json":
			if err := json.NewDecoder(tr).Decode(&index); err != nil {
				return nil, fmt.Errorf("decode tw-stats index: %w", err)
			}
		case len(parts) == 4 && parts[1] == "docs" && parts[3] == "index.json":
			data, err := parseIndicator(parts[2], tr)
			if err != nil {
				// 原始資料偶有壞檔（例如 JSON 格式錯誤），跳過單一指標不影響整體
				log.Logger().Warn(fmt.Sprintf("tw-stats skip %s: %v", parts[2], err))
				continue
			}
			parsed[parts[2]] = data
		}
	}
	if index == nil {
		return nil, errors.New("tw-stats tarball missing docs/index.json")
	}
	return buildCube(index, parsed, time.Now()), nil
}

func parseIndicator(name string, r io.Reader) (*indicatorData, error) {
	raw := make(map[string]map[string]any)
	decoder := json.NewDecoder(r)
	decoder.UseNumber()
	if err := decoder.Decode(&raw); err != nil {
		return nil, err
	}
	data := &indicatorData{Name: name, Rows: make(map[int]*row, len(raw))}
	for yearText, fields := range raw {
		year, err := strconv.Atoi(yearText)
		if err != nil {
			continue
		}
		var values row
		hasValue := false
		for i, area := range areas {
			values[i] = parseNumber(fields[area.Code])
			hasValue = hasValue || !math.IsNaN(values[i])
		}
		values[totalColumn] = parseNumber(fields["Total"])
		// 整年全空的不收錄；原始資料有被截斷覆寫的檔案，第一段 JSON 合法但值全是空字串，全空的指標最後會在 buildCube 被略過
		if !hasValue {
			continue
		}
		data.Rows[year] = &values
		data.Years = append(data.Years, year)
		if data.Unit == "" {
			data.Unit, data.Explain = stringValue(fields["Unit"], ""), stringValue(fields["Explain"], "")
		}
	}
	sort.Ints(data.Years)
	return data, nil
}

// buildCube 以 index（key→名稱）為準組裝；index 有但檔案缺漏或解析失敗的指標直接略過
func buildCube(index map[string]string, parsed map[string]*indicatorData, loadedAt time.Time) *Cube {
	cube := &Cube{byName: make(map[string]*indicatorData, len(index)), LoadedAt: loadedAt}
	latestCount := make(map[int]int)
	for key, name := range index {
		data, ok := parsed[name]
		if !ok || len(data.Years) == 0 {
			continue
		}
		data.Key, data.Category, data.PerCapita = key, categoryOf(key), canPerCapita(name, data.Unit)
		cube.indicators = append(cube.indicators, data)
		cube.byName[name] = data
		latestCount[data.Years[len(data.Years)-1]]++
	}
	sort.Slice(cube.indicators, func(i, j int) bool { return cube.indicators[i].Key < cube.indicators[j].Key })

	// 人口指標缺漏時無法換算，全部退回原始值排名
	if cube.population = cube.byName[populationIndicator]; cube.population == nil {
		for _, data := range cube.indicators {
			data.PerCapita = false
		}
	}
	for year, count := range latestCount {
		if count > latestCount[cube.latestYear] || count == latestCount[cube.latestYear] && year > cube.latestYear {
			cube.latestYear = year
		}
	}
	return cube
}

func parseNumber(value any) float64 {
	parsed, err := strconv.ParseFloat(strings.ReplaceAll(strings.TrimSpace(stringValue(value, "")), ",", ""), 64)
	if err != nil {
		return math.NaN()
	}
	return parsed
}

func (d *indicatorData) value(year, column int) (float64, bool) {
	values, ok := d.Rows[year]
	if !ok || math.IsNaN(values[column]) {
		return 0, false
	}
	return values[column], true
}

// rankValue 排名／相關係數用的值：數量類指標換算每萬人，避免人口多的縣市在所有數量指標都拿第一
func (c *Cube) rankValue(d *indicatorData, year, column int) (float64, bool) {
	value, ok := d.value(year, column)
	if !ok || !d.PerCapita {
		return value, ok
	}
	population, ok := c.population.value(year, column)
	if !ok || population == 0 {
		return 0, false
	}
	return value / population * perCapitaBase, true
}

// countyRanks 回傳某年 22 縣市的競賽排名（數值高者在前，同值同名次：1、2、2、4），無資料的縣市不列入
func (c *Cube) countyRanks(d *indicatorData, year int) map[int]int {
	type entry struct {
		column int
		value  float64
	}
	entries := make([]entry, 0, totalColumn-1)
	for column := 1; column < totalColumn; column++ {
		if value, ok := c.rankValue(d, year, column); ok {
			entries = append(entries, entry{column, value})
		}
	}
	sort.SliceStable(entries, func(i, j int) bool { return entries[i].value > entries[j].value })
	ranks := make(map[int]int, len(entries))
	for i, e := range entries {
		if i > 0 && e.value == entries[i-1].value {
			ranks[e.column] = ranks[entries[i-1].column]
		} else {
			ranks[e.column] = i + 1
		}
	}
	return ranks
}
