package taipower

import (
	"errors"
	"strings"
	"testing"

	taipowerModel "faryne.dev/model/entity/opendata/taipower"
	taipowerRepo "faryne.dev/repository/taipower"
	"github.com/stretchr/testify/require"
)

func TestValidateNeighborStatisticsPreservesTotals(t *testing.T) {
	index := taipowerRepo.NeighborSummary{Count: 2, TotalCash: 30, LatestMonth: 202609, VersionedCount: 2}
	cityArea := &taipowerModel.NeighborStatisticsOutput{Data: []taipowerModel.NeighborStatistic{{Name: "臺中市龍井區", TotalCash: 30}}}
	unit := &taipowerModel.NeighborStatisticsOutput{Data: []taipowerModel.NeighborStatistic{{Name: "某單位", TotalCash: 30}}}
	purpose := &taipowerModel.NeighborPurposeStatisticsOutput{Data: []taipowerModel.NeighborPurposeStatistic{
		{Year: 2026, CityArea: "臺中市龍井區", Purpose: purposeEnergy, Count: 1, TotalCash: 10},
		{Year: 2026, CityArea: "臺中市龍井區", Purpose: purposeUnclassified, Count: 1, TotalCash: 20},
	}}
	require.NoError(t, validateNeighborSummaries(index, index))
	require.NoError(t, validateNeighborStatistics(index, cityArea, unit, purpose))
	purpose.Data[1].Count = 0
	require.Error(t, validateNeighborStatistics(index, cityArea, unit, purpose))
	unit.Data[0].TotalCash = 20
	require.Error(t, validateNeighborStatistics(index, cityArea, unit, purpose))
}

func TestPublishNeighborFilesKeepsManifestLast(t *testing.T) {
	manifest := neighborStatisticsManifest{Files: map[string]string{"cityarea": "v/cityarea.json", "unit": "v/unit.json", "purpose": "v/purpose.json"}}
	contents := map[string]any{"cityarea": 1, "unit": 2, "purpose": 3}
	var keys []string
	upload := func(key string, _ []byte, _ string) error {
		keys = append(keys, key)
		if strings.HasSuffix(key, "purpose.json") {
			return errors.New("s3 unavailable")
		}
		return nil
	}
	require.Error(t, publishNeighborFiles(contents, manifest, upload))
	require.NotContains(t, keys, statisticsObjectPrefix+"/manifest.json")
	keys = nil
	require.NoError(t, publishNeighborFiles(contents, manifest, func(key string, _ []byte, _ string) error { keys = append(keys, key); return nil }))
	require.Equal(t, statisticsObjectPrefix+"/manifest.json", keys[len(keys)-1])
}
