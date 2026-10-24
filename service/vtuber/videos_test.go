package vtuber

import (
	"testing"
	"time"

	"github.com/stretchr/testify/require"
)

func TestUploadsPlaylistID(t *testing.T) {
	const channel = "UCCzUftO8KOVkV4wQG1vkUvg"
	for videoType, want := range map[string]string{
		"":      "UUCzUftO8KOVkV4wQG1vkUvg", // 沒給就是全部
		"all":   "UUCzUftO8KOVkV4wQG1vkUvg",
		"live":  "UULVCzUftO8KOVkV4wQG1vkUvg",
		"video": "UULFCzUftO8KOVkV4wQG1vkUvg",
		"short": "UUSHCzUftO8KOVkV4wQG1vkUvg",
	} {
		got, err := uploadsPlaylistID(channel, videoType)
		require.NoError(t, err, videoType)
		require.Equal(t, want, got, videoType)
	}
	// 會員限定不開放，其他亂打的分類回參數錯誤
	_, err := uploadsPlaylistID(channel, "members")
	require.ErrorIs(t, err, ErrInvalidRequest)
}

func TestVideosCacheTTL(t *testing.T) {
	require.Equal(t, 30*time.Minute, videosCacheTTL(""))
	require.Equal(t, 6*time.Hour, videosCacheTTL("EAAaBlBUOkNESQ"))
}
