package background

import (
	"context"
	"errors"
	"sync"
)

// ErrDraining 代表程序已經進入重啟／關機 drain 階段，不再接受新的背景工作。
var ErrDraining = errors.New("background work is draining")

// Tracker 追蹤必須在優雅重啟前跑完的背景工作；agentic 對話與之後重要 cron job
// 都應該掛同一套，避免 main.go 關機流程要逐一認得各種 goroutine。
type Tracker struct {
	mu       sync.Mutex
	wg       sync.WaitGroup
	ctx      context.Context
	cancel   context.CancelFunc
	draining bool
}

var defaultTracker = NewTracker()

func NewTracker() *Tracker {
	ctx, cancel := context.WithCancel(context.Background())
	return &Tracker{ctx: ctx, cancel: cancel}
}

func Default() *Tracker { return defaultTracker }

func Context() context.Context { return defaultTracker.Context() }

func Track(name string) (func(), error) { return defaultTracker.Track(name) }

func BeginDrain() { defaultTracker.BeginDrain() }

func Wait() { defaultTracker.Wait() }

func Cancel() { defaultTracker.Cancel() }

func (t *Tracker) Context() context.Context {
	if t == nil {
		return context.Background()
	}
	return t.ctx
}

func (t *Tracker) Track(name string) (func(), error) {
	if t == nil {
		return func() {}, nil
	}
	t.mu.Lock()
	defer t.mu.Unlock()
	if t.draining {
		return nil, ErrDraining
	}
	t.wg.Add(1)
	var once sync.Once
	return func() { once.Do(t.wg.Done) }, nil
}

func (t *Tracker) BeginDrain() {
	if t == nil {
		return
	}
	t.mu.Lock()
	t.draining = true
	t.mu.Unlock()
}

func (t *Tracker) Wait() {
	if t == nil {
		return
	}
	t.wg.Wait()
}

func (t *Tracker) Cancel() {
	if t == nil {
		return
	}
	t.cancel()
}
