package taipower

import (
	"testing"

	"github.com/stretchr/testify/require"
)

func TestValidateNeighborStatisticGroup(t *testing.T) {
	require.NoError(t, ValidateNeighborStatisticGroup("unit"))
	require.NoError(t, ValidateNeighborStatisticGroup("cityarea"))
	require.Error(t, ValidateNeighborStatisticGroup("summary"))
}

func TestNormalizeCityArea(t *testing.T) {
	require.Equal(
		t,
		"彰化縣鹿港鎮",
		normalizeCityArea("鹿港鎮", "彰化縣鹿港鎮公所"),
	)
	require.Equal(
		t,
		"臺中市龍井區",
		normalizeCityArea("臺中市龍井區", "臺中市龍井區公所"),
	)
	require.Equal(t, "鹿港鎮", normalizeCityArea("鹿港鎮", "無法判斷單位"))
}

func TestIsValidCityArea(t *testing.T) {
	require.True(t, isValidCityArea("新北市板橋區"))
	require.True(t, isValidCityArea("彰化縣鹿港鎮"))
	require.True(t, isValidCityArea("宜蘭縣三星鄉"))
	require.True(t, isValidCityArea("彰化縣彰化市"))

	require.False(t, isValidCityArea("高雄市"))
	require.False(t, isValidCityArea("aa"))
	require.False(t, isValidCityArea("台北縣aa"))
	require.False(t, isValidCityArea("苗栗縣"))
	require.False(t, isValidCityArea("鹿港鎮"))
}
