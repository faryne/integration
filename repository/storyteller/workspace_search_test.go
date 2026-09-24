package storyteller

import (
	"testing"

	"github.com/stretchr/testify/require"
)

func TestWorkspaceSearchPatternsEscapesLikeWildcards(t *testing.T) {
	exact, prefix, contains := workspaceSearchPatterns(" 100%_= ")
	require.Equal(t, "100%_=", exact)
	require.Equal(t, "100=%=_==%", prefix)
	require.Equal(t, "%100=%=_==%", contains)
}
