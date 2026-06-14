package taipower

import (
	"testing"
	"time"

	taipowerModel "faryne.dev/model/entity/opendata/taipower"
	"faryne.dev/service/crawler"
	"github.com/stretchr/testify/require"
)

func TestParseNeighbors(t *testing.T) {
	text := func(value string) crawler.SelectorResponse {
		return crawler.SelectorResponse{Text: &value}
	}
	resp := map[string]any{
		"neighbors": []any{
			crawler.SelectorResponse{Children: map[string]any{
				"obj_month_id": text("1"),
				"cityarea":     text("高雄市路竹區"),
				"unit":         text("高雄市路竹大社長青協會"),
				"summary":      text("辦理會員聯誼活動"),
				"cash":         text("1,230.500"),
				"apply_reason": text("敦親睦鄰提升企業形象"),
			}},
		},
	}
	now := time.Date(2026, 6, 12, 0, 0, 0, 0, time.Local)

	items, err := parseNeighbors(resp, 2026, 5, now)

	require.NoError(t, err)
	require.Len(t, items, 1)
	require.Equal(t, 1, items[0].ObjMonthID)
	require.Equal(t, 1230.5, items[0].Cash)
	require.Equal(t, 2026, items[0].ObjYear)
	require.Equal(t, 5, items[0].ObjMonth)
	require.Equal(t, now, items[0].CreatedOn)
}

func TestParseNeighborsSkipsEmptyPlaceholderRow(t *testing.T) {
	text := func(value string) crawler.SelectorResponse {
		return crawler.SelectorResponse{Text: &value}
	}
	resp := map[string]any{
		"neighbors": []any{
			crawler.SelectorResponse{Children: map[string]any{
				"obj_month_id": text("633"),
				"cityarea":     text(""),
				"unit":         text(""),
				"summary":      text(""),
				"cash":         text(""),
				"apply_reason": text(""),
			}},
		},
	}

	items, err := parseNeighbors(resp, 2021, 4, time.Now())

	require.NoError(t, err)
	require.Empty(t, items)
}

func TestNeighborDuplicateHashUsesIdentityFields(t *testing.T) {
	item := taipowerModel.Neighbor{
		ObjYear:  2026,
		ObjMonth: 5,
		CityArea: "高雄市路竹區",
		Unit:     "測試單位",
		Summary:  "測試摘要",
		Cash:     30,
	}

	hash := neighborDuplicateHash(item)
	require.Len(t, hash, 64)
	require.Equal(t, hash, neighborDuplicateHash(item))

	item.ObjMonth = 6
	require.NotEqual(t, hash, neighborDuplicateHash(item))
}

func TestParseCrawlMonth(t *testing.T) {
	month, err := parseCrawlMonth("2025-01")
	require.NoError(t, err)
	require.Equal(t, 2025, month.Year())
	require.Equal(t, time.January, month.Month())

	_, err = parseCrawlMonth("")
	require.Error(t, err)
	_, err = parseCrawlMonth("2025-1")
	require.Error(t, err)
	_, err = parseCrawlMonth("2015-12")
	require.Error(t, err)
}

func TestCrawlRangeRejectsInvalidRange(t *testing.T) {
	service := &NeighborService{
		now: func() time.Time {
			return time.Date(2026, time.June, 14, 0, 0, 0, 0, time.Local)
		},
	}

	require.Error(t, service.CrawlRange("2026-02", "2026-01"))
}
