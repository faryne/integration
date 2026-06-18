package main

import (
	"testing"

	"github.com/stretchr/testify/require"
)

func TestNCCCDownloadCronRunsMonthlyOnFifteenth(t *testing.T) {
	for _, job := range cronJobs {
		if job.Name == "nccc-download" {
			require.Equal(t, "12 3 15 * *", job.Schedule)
			return
		}
	}
	require.Fail(t, "nccc-download cron job not found")
}
