package chrome_helper

import (
	"context"
	"time"

	"faryne.dev/config"

	"github.com/chromedp/chromedp"
)

type ChromeHelperInstance struct {
	Ctx     context.Context
	Cancels []context.CancelFunc
}

func New(opts ...chromedp.ExecAllocatorOption) *ChromeHelperInstance {
	return NewWithTimeout(60*time.Second, opts...)
}

func NewWithTimeout(timeout time.Duration, opts ...chromedp.ExecAllocatorOption) *ChromeHelperInstance {
	if len(opts) > 0 {
		opts = append(chromedp.DefaultExecAllocatorOptions[:], opts...)
	} else {
		opts = chromedp.DefaultExecAllocatorOptions[:]
	}

	allocCtx, cancel1 := chromedp.NewExecAllocator(context.Background(), opts...)

	ctx, cancel2 := chromedp.NewContext(allocCtx)

	ctx, cancel3 := context.WithTimeout(ctx, timeout)

	return &ChromeHelperInstance{
		Ctx:     ctx,
		Cancels: []context.CancelFunc{cancel1, cancel2, cancel3},
	}
}

func NewDefaultInstance() *ChromeHelperInstance {
	return NewDefaultInstanceWithTimeout(60 * time.Second)
}

func NewDefaultInstanceWithTimeout(timeout time.Duration) *ChromeHelperInstance {
	return NewWithTimeout(
		timeout,
		chromedp.NoSandbox,
		chromedp.Headless,
		chromedp.DisableGPU,
		chromedp.ExecPath(config.EnvConfig().ChromePath),
	)
}
