package agent

import "context"

type applyItemProgressReporter func(eventType, detail string) error
type applyItemProgressKey struct{}

// withApplyItemProgress 讓實際套用器能回報單一提案內的細部進度，並由 TaskManager 統一落盤與通知畫面。
func withApplyItemProgress(ctx context.Context, reporter applyItemProgressReporter) context.Context {
	return context.WithValue(ctx, applyItemProgressKey{}, reporter)
}

// ReportApplyItemProgress 回報由套用器掌握的細部 lifecycle；未由 TaskManager 執行時安全略過。
func ReportApplyItemProgress(ctx context.Context, eventType, detail string) error {
	reporter, _ := ctx.Value(applyItemProgressKey{}).(applyItemProgressReporter)
	if reporter == nil {
		return nil
	}
	return reporter(eventType, detail)
}
