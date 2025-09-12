package log

import (
	"fmt"
	"go.uber.org/zap"
	"strings"
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

type DBLogger struct{}

func (o *DBLogger) Printf(pattern string, msg ...interface{}) {
	fmt.Printf(strings.Replace(pattern, "\n", "\t", -1)+"\n", msg...)
}
