package taipower

import (
	"encoding/json"
	"testing"

	"github.com/stretchr/testify/require"
)

func TestNeighborRebuildMappingPreservesCashPrecision(t *testing.T) {
	var mapping struct {
		Mappings struct {
			Properties map[string]struct {
				Type string `json:"type"`
			} `json:"properties"`
		} `json:"mappings"`
	}
	require.NoError(t, json.Unmarshal([]byte(neighborRebuildMapping), &mapping))
	require.Equal(t, "double", mapping.Mappings.Properties["cash"].Type)
	for _, field := range []string{"cityarea_key", "unit_key", "purpose_key", "normalization_version", "purpose_rule_version"} {
		require.Equal(t, "keyword", mapping.Mappings.Properties[field].Type)
	}
}

func TestNeighborAliasActionsRemoveOldIndexBeforePromotion(t *testing.T) {
	require.Equal(t, []map[string]any{
		{"remove_index": map[string]any{"index": "taipower_neighbor"}},
		{"add": map[string]any{"index": "taipower_neighbor_v2_1", "alias": neighborIndexName}},
	}, neighborAliasActions("taipower_neighbor", "taipower_neighbor_v2_1"))
}
