package background

import (
	"errors"
	"testing"
	"time"

	"github.com/stretchr/testify/require"
)

func TestTrackerRejectsNewWorkAfterDrainAndWaitsExistingWork(t *testing.T) {
	tracker := NewTracker()
	done, err := tracker.Track("test.work")
	require.NoError(t, err)

	waitReturned := make(chan struct{})
	go func() {
		tracker.BeginDrain()
		tracker.Wait()
		close(waitReturned)
	}()

	select {
	case <-waitReturned:
		t.Fatal("Wait returned before tracked work finished")
	case <-time.After(20 * time.Millisecond):
	}

	_, err = tracker.Track("test.rejected")
	require.True(t, errors.Is(err, ErrDraining))

	done()
	select {
	case <-waitReturned:
	case <-time.After(time.Second):
		t.Fatal("Wait did not return after tracked work finished")
	}
}

func TestTrackerCancelHappensAfterExplicitCancel(t *testing.T) {
	tracker := NewTracker()
	select {
	case <-tracker.Context().Done():
		t.Fatal("tracker context should stay active before Cancel")
	default:
	}
	tracker.Cancel()
	select {
	case <-tracker.Context().Done():
	case <-time.After(time.Second):
		t.Fatal("tracker context was not canceled")
	}
}
