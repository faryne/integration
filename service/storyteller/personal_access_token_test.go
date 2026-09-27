package storyteller

import (
	"strings"
	"testing"

	"github.com/stretchr/testify/require"
)

func TestPersonalAccessTokenPublicIDUsesIndependentRandomID(t *testing.T) {
	first, err := generatePersonalAccessTokenPublicID()
	require.NoError(t, err)
	second, err := generatePersonalAccessTokenPublicID()
	require.NoError(t, err)

	require.True(t, strings.HasPrefix(first, "pat_"))
	require.Len(t, first, len("pat_")+16)
	require.NotEqual(t, first, second)
}
