package chrome_helper

import (
	"context"
	"faryne.dev/config"
	"github.com/chromedp/chromedp"
	"time"
)

type ChromeHelperInstance struct {
	Ctx     context.Context
	Cancels []context.CancelFunc
}

func New(opts ...chromedp.ExecAllocatorOption) *ChromeHelperInstance {
	if len(opts) > 0 {
		opts = append(chromedp.DefaultExecAllocatorOptions[:], opts...)
	} else {
		opts = chromedp.DefaultExecAllocatorOptions[:]
	}

	allocCtx, cancel1 := chromedp.NewExecAllocator(context.Background(), opts...)

	ctx, cancel2 := chromedp.NewContext(allocCtx)

	ctx, cancel3 := context.WithTimeout(ctx, 60*time.Second)

	return &ChromeHelperInstance{
		Ctx:     ctx,
		Cancels: []context.CancelFunc{cancel1, cancel2, cancel3},
	}
}

func NewDefaultInstance() *ChromeHelperInstance {
	return New(
		chromedp.NoSandbox,
		chromedp.Headless,
		chromedp.DisableGPU,
		chromedp.ExecPath(config.EnvConfig().ChromePath),
	)
}
