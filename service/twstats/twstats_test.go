package twstats

import (
	"archive/tar"
	"bytes"
	"compress/gzip"
	"context"
	"encoding/json"
	"io"
	"net/http"
	"testing"

	"github.com/stretchr/testify/require"

	model "faryne.dev/model/entity/opendata/twstats"
)

type roundTripFunc func(*http.Request) (*http.Response, error)

func (f roundTripFunc) RoundTrip(req *http.Request) (*http.Response, error) { return f(req) }

// 測試資料：竊盜案在金門絕對數最少、換算每萬人卻最高，用來驗證數量類指標以每萬人排名
var fixture = map[string]map[string]map[string]string{
	"戶籍登記人口數": {
		"2023": {"Unit": "人", "Taiwan": "23,000,000", "Taipei": "2,500,000", "NewTaipei": "4,000,000", "Kinmen": "100,000"},
		"2024": {"Unit": "人", "Taiwan": "23,100,000", "Taipei": "2,500,000", "NewTaipei": "4,000,000", "Kinmen": "100,000"},
	},
	"竊盜案發生數": {
		"2023": {"Unit": "件", "Explain": "竊盜", "Total": "30,000", "Taiwan": "30,000", "Taipei": "5,000", "NewTaipei": "6,000", "Kinmen": "250"},
		"2024": {"Unit": "件", "Explain": "竊盜", "Total": "27,000", "Taiwan": "27,000", "Taipei": "3,000", "NewTaipei": "6,000", "Kinmen": "300"},
	},
	"人口密度": {
		"2024": {"Unit": "人/平方公里", "Taiwan": "645", "Taipei": "9164", "NewTaipei": "1971", "Kinmen": "-"},
	},
}

func TestRefreshParsesTarballAndSkipsBrokenFiles(t *testing.T) {
	service := loadedService(t)
	cube, err := service.loadedCube()

	require.NoError(t, err)
	require.Len(t, cube.indicators, 3)
	require.True(t, cube.byName["竊盜案發生數"].PerCapita)
	require.False(t, cube.byName["人口密度"].PerCapita)
	require.False(t, cube.byName[populationIndicator].PerCapita)
	require.Equal(t, 2024, cube.latestYear)
}

func TestNotReadyBeforeRefresh(t *testing.T) {
	_, err := NewService().Search(context.Background(), "", 1, 30)
	require.ErrorIs(t, err, ErrNotReady)
}

func TestSearchFiltersAndPaginatesIndicators(t *testing.T) {
	result, err := loadedService(t).Search(context.Background(), "人口", 1, 1)

	require.NoError(t, err)
	require.Equal(t, 2, result.Total)
	require.Len(t, result.Data, 1)
	require.Contains(t, result.Data[0].PageURL, "/data/tw-stats/")
}

func TestRetrieveFiltersYearsAndAreas(t *testing.T) {
	result, err := loadedService(t).Retrieve(context.Background(), RetrieveRequest{
		Name: "竊盜案發生數", StartYear: 2023, EndYear: 2024, Years: []int{2024}, Areas: []string{"台灣", "Taipei"},
	})

	require.NoError(t, err)
	require.Equal(t, "件", result.Unit)
	require.Equal(t, map[string]string{"Taiwan": "台灣", "Taipei": "台北市"}, result.Areas)
	require.Equal(t, []YearData{{Year: 2024, Total: "27000", Values: map[string]string{"Taiwan": "27000", "Taipei": "3000"}}}, result.Data)
}

func TestRetrieveRejectsUnsupportedArea(t *testing.T) {
	_, err := loadedService(t).Retrieve(context.Background(), RetrieveRequest{Name: "人口密度", Areas: []string{"不存在"}})
	require.EqualError(t, err, "unsupported area: 不存在")
}

func TestRankUsesPerCapitaValues(t *testing.T) {
	result, err := loadedService(t).Rank(context.Background(), "竊盜案發生數", 0)

	require.NoError(t, err)
	require.Equal(t, 2024, result.Year)
	require.Equal(t, []string{"Kinmen", "NewTaipei", "Taipei"}, areaCodes(result.Entries))
	require.InDelta(t, 30.0, *result.Entries[0].PerCapitaValue, 0.001)
}

func TestAreaProfileRanksAndChangeRate(t *testing.T) {
	result, err := loadedService(t).AreaProfile(context.Background(), "台北市", model.AreaProfileRequest{})

	require.NoError(t, err)
	theft := findIndicator(t, result.Indicators, "竊盜案發生數")
	require.Equal(t, 3, theft.Rank)
	require.Equal(t, 3, theft.RankTotal)
	require.InDelta(t, -40.0, *theft.ChangeRate, 0.001)
	density := findIndicator(t, result.Indicators, "人口密度")
	require.Equal(t, 1, density.Rank)
	require.Equal(t, 2, density.RankTotal) // 金門無資料不列入
	require.Nil(t, density.ChangeRate)
}

func TestAreaProfileRejectsTaiwan(t *testing.T) {
	_, err := loadedService(t).AreaProfile(context.Background(), "Taiwan", model.AreaProfileRequest{})
	require.Error(t, err)
}

func TestMoversRanksCountiesByRankChange(t *testing.T) {
	result, err := loadedService(t).Movers(context.Background(), model.MoversRequest{})

	require.NoError(t, err)
	require.Equal(t, 2024, result.Year)
	require.Equal(t, "竊盜案發生數", result.National[0].Name)
	require.InDelta(t, -10.0, result.National[0].ChangeRate, 0.001)
	// 每萬人：2023 台北 20、新北 15；2024 台北 12、新北 15 → 兩者名次互換，同幅度時年增率大的（台北 -40%）在前
	require.Len(t, result.Counties, 2)
	require.Equal(t, "Taipei", result.Counties[0].Area.Code)
	require.Equal(t, -1, result.Counties[0].RankChange)
}

func TestCorrelate(t *testing.T) {
	result, err := loadedService(t).Correlate(context.Background(), "戶籍登記人口數", "竊盜案發生數", 2024)

	require.NoError(t, err)
	require.Len(t, result.Points, 3)
	require.Less(t, result.Coefficient, 0.0) // 竊盜換算每萬人後，人口越少的縣市反而越高
}

func loadedService(t *testing.T) *Service {
	t.Helper()
	tarball := buildTarball(t)
	service := &Service{tarballURL: "https://example.test/tw-stats.tar.gz", client: &http.Client{
		Transport: roundTripFunc(func(*http.Request) (*http.Response, error) {
			return &http.Response{StatusCode: http.StatusOK, Header: make(http.Header), Body: io.NopCloser(bytes.NewReader(tarball))}, nil
		}),
	}}
	require.NoError(t, service.Refresh(context.Background()))
	return service
}

// buildTarball 模擬 GitHub codeload 打包格式，另外放一個逐年檔與一個壞檔，驗證兩者都被略過
func buildTarball(t *testing.T) []byte {
	t.Helper()
	var buffer bytes.Buffer
	gz := gzip.NewWriter(&buffer)
	tw := tar.NewWriter(gz)
	write := func(name string, body []byte) {
		require.NoError(t, tw.WriteHeader(&tar.Header{Name: "tw-stats-master/" + name, Mode: 0o644, Size: int64(len(body))}))
		_, err := tw.Write(body)
		require.NoError(t, err)
	}
	index := map[string]string{"0008": "戶籍登記人口數", "0198": "竊盜案發生數", "0029": "人口密度", "0630": "年度失業率-男"}
	indexJSON, _ := json.Marshal(index)
	write("docs/index.json", indexJSON)
	for name, years := range fixture {
		body, _ := json.Marshal(years)
		write("docs/"+name+"/index.json", body)
		write("docs/"+name+"/2024.json", []byte(`{"ignored":true}`))
	}
	write("docs/年度失業率-男/index.json", []byte(`{"2024":{"Taipei":""}} "4.20"}`)) // 仿真實壞檔：截斷覆寫且值全空
	require.NoError(t, tw.Close())
	require.NoError(t, gz.Close())
	return buffer.Bytes()
}

func areaCodes(entries []model.RankEntry) []string {
	codes := make([]string, 0, len(entries))
	for _, entry := range entries {
		codes = append(codes, entry.Area.Code)
	}
	return codes
}

func findIndicator(t *testing.T, rows []model.AreaIndicator, name string) model.AreaIndicator {
	t.Helper()
	for _, row := range rows {
		if row.Name == name {
			return row
		}
	}
	require.FailNow(t, "indicator not found: "+name)
	return model.AreaIndicator{}
}
