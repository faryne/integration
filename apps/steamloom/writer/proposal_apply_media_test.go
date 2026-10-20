package main

import (
	"context"
	"sync"
	"sync/atomic"
	"testing"
	"time"

	"faryne.dev/apps/steamloom/writer/internal/mediaworker"
)

func TestExecuteStaggeredMediaRunsLimitsConcurrency(t *testing.T) {
	var running, maximum atomic.Int32
	var mu sync.Mutex
	starts := []time.Time{}
	outcomes := executeStaggeredMediaRuns(context.Background(), 3, mediaworker.ExecutionPolicy{LaunchInterval: 20 * time.Millisecond, MaxConcurrency: 2}, func(run int) mediaRunOutcome {
		current := running.Add(1)
		defer running.Add(-1)
		for peak := maximum.Load(); current > peak && !maximum.CompareAndSwap(peak, current); peak = maximum.Load() {
		}
		mu.Lock()
		starts = append(starts, time.Now())
		mu.Unlock()
		time.Sleep(60 * time.Millisecond)
		return mediaRunOutcome{run: run}
	})
	if len(outcomes) != 3 || maximum.Load() != 2 {
		t.Fatalf("outcomes=%d max concurrency=%d", len(outcomes), maximum.Load())
	}
	if len(starts) != 3 || starts[1].Sub(starts[0]) < 15*time.Millisecond {
		t.Fatalf("jobs were not staggered: %#v", starts)
	}
}
