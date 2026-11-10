package taipower

import (
	"testing"

	"github.com/stretchr/testify/require"
)

func TestCityAreaKey(t *testing.T) {
	require.Equal(t, "臺中市龍井區", cityAreaKey("台中市龍井區", ""))
	require.Equal(t, "臺中市龍井區", cityAreaKey("臺中市龍井區", ""))
	require.Equal(t, "臺中縣龍井鄉", cityAreaKey("台中縣龍井鄉", ""))
	require.Equal(t, "臺中市龍井區", cityAreaKey("龍井區", "台中市龍井區公所"))
	require.Equal(t, unknownCityAreaKey, cityAreaKey("不明", ""))
}

func TestUnitKey(t *testing.T) {
	require.Equal(t, "臺中市龍井區公所", unitKey("台中市龍井區公所"))
	require.Equal(t, "臺中市龍井區公所", unitKey("臺中市龍井區公所"))
	require.Equal(t, "台灣電力公司", unitKey("台灣電力公司"))
}
