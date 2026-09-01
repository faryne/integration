package main

import (
	"testing"
	"time"

	"faryne.dev/service/background"
	"github.com/stretchr/testify/require"
)

func TestNCCCDownloadCronRunsMonthlyOnFifteenth(t *testing.T) {
	for _, job := range cronJobs["nccc"].Jobs {
		if job.Name == "nccc-download" {
			require.Equal(t, "12 3 15 * *", job.Schedule)
			return
		}
	}
	require.Fail(t, "nccc-download cron job not found")
}

func TestWaitBackgroundWorkBeforeShutdownWaitsTrackedWork(t *testing.T) {
	original := appBackgroundWork
	tracker := background.NewTracker()
	appBackgroundWork = tracker
	t.Cleanup(func() { appBackgroundWork = original })

	done, err := tracker.Track("test.long_job")
	if err != nil {
		t.Fatal(err)
	}
	beginBackgroundWorkDrain()

	waitReturned := make(chan struct{})
	go func() {
		waitBackgroundWorkBeforeShutdown()
		close(waitReturned)
	}()

	select {
	case <-waitReturned:
		t.Fatal("shutdown drain returned before background work finished")
	case <-time.After(20 * time.Millisecond):
	}

	done()
	select {
	case <-waitReturned:
	case <-time.After(time.Second):
		t.Fatal("shutdown drain did not return after background work finished")
	}

	select {
	case <-tracker.Context().Done():
	case <-time.After(time.Second):
		t.Fatal("background context was not canceled after drain")
	}
}
