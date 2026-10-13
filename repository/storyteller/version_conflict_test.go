package storyteller

import (
	"fmt"
	"testing"

	"github.com/stretchr/testify/require"
)

func TestIsVersionConflict(t *testing.T) {
	err := fmt.Errorf("conditional write failed: %w", &VersionConflictError{Resource: "story", LatestVersionID: 42})
	require.True(t, IsVersionConflict(err))
	require.EqualError(t, err, "conditional write failed: story version conflict: latest version is 42")
}
