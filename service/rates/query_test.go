package rates

import (
	"testing"
	"time"

	"github.com/stretchr/testify/require"

	"faryne.dev/model/entity"
	ratesEntity "faryne.dev/model/entity/opendata/rates"
)

func TestNormalizeQuery(t *testing.T) {
	now := time.Date(2026, 10, 22, 23, 0, 0, 0, taipei)
	date := func(s string) entity.OnlyDateFormat {
		d, _ := time.Parse(time.DateOnly, s)
		return entity.OnlyDateFormat(d)
	}
	format := func(d entity.OnlyDateFormat) string { return d.Time().Format(time.DateOnly) }

	// 沒給日期：今天往回共 7 天；幣別轉大寫
	req, err := normalizeQuery(ratesEntity.RateRequest{Currencies: []string{" usd", "jpy"}}, now)
	require.NoError(t, err)
	require.Equal(t, "2026-10-16", format(req.BeginDate))
	require.Equal(t, "2026-10-22", format(req.EndDate))
	require.Equal(t, []string{"USD", "JPY"}, req.Currencies)

	// 只給 end：往回 7 天
	req, err = normalizeQuery(ratesEntity.RateRequest{EndDate: date("2026-01-10")}, now)
	require.NoError(t, err)
	require.Equal(t, "2026-01-04", format(req.BeginDate))

	// 剛好 93 天可以，94 天不行
	_, err = normalizeQuery(ratesEntity.RateRequest{BeginDate: date("2026-01-01"), EndDate: date("2026-04-03")}, now)
	require.NoError(t, err)
	_, err = normalizeQuery(ratesEntity.RateRequest{BeginDate: date("2026-01-01"), EndDate: date("2026-04-04")}, now)
	require.ErrorContains(t, err, "at most 93 days")

	_, err = normalizeQuery(ratesEntity.RateRequest{BeginDate: date("2026-02-01"), EndDate: date("2026-01-01")}, now)
	require.ErrorContains(t, err, "after end_date")

	_, err = normalizeQuery(ratesEntity.RateRequest{ServiceName: "Chinatrust"}, now)
	require.ErrorContains(t, err, "unknown bank")
}
