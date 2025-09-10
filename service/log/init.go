package log

import (
	"go.uber.org/zap"
	"sync"
)

var l *zap.Logger
var s sync.Once

func init() {
	s.Do(func() {
		if l == nil {
			l, _ = zap.NewProduction()
			defer l.Sync()
		}
	})
}

func Logger() *zap.Logger {
	return l
}
