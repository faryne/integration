package taipower

import (
	"testing"
	"time"

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

	items, err := parseNeighbors(resp, 115, 5, now)

	require.NoError(t, err)
	require.Len(t, items, 1)
	require.Equal(t, 1, items[0].ObjMonthID)
	require.Equal(t, 1230.5, items[0].Cash)
	require.Equal(t, 115, items[0].ObjYear)
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

	items, err := parseNeighbors(resp, 110, 4, time.Now())

	require.NoError(t, err)
	require.Empty(t, items)
}
