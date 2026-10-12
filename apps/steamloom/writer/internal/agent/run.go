package agent

import (
	"bytes"
	"context"
	"errors"
	"fmt"
	"os"
	"regexp"
	"strings"
)

// 解析不到回答，而且 CLI 也沒給自己的錯誤說明時用。真正的執行失敗優先顯示 stderr。
var errNoResult = errors.New("沒有取得回答")

// outputError 是 CLI 已經用它自己的格式說明失敗；比 stderr 的雜訊優先顯示。
type outputError struct{ msg string }

func (e outputError) Error() string { return e.msg }

var ansi = regexp.MustCompile(`\x1b\[[0-9;]*[A-Za-z]`)

type invocation struct {
	name   string
	bin    string
	dir    string
	args   []string
	stdin  string
	parse  func(stdout string) (Reply, error)
	resume string
}

func invoke(ctx context.Context, call invocation) (Reply, error) {
	stdout, runErr := run(ctx, call.name, call.bin, call.dir, call.args, call.stdin)
	reply, parseErr := call.parse(stdout)
	if parseErr == nil {
		if reply.SessionID == "" {
			reply.SessionID = call.resume
		}
		return reply, nil
	}
	var structured outputError
	if errors.As(parseErr, &structured) {
		return Reply{}, structured
	}
	if runErr != nil {
		return Reply{}, runErr
	}
	return Reply{}, parseErr
}

func run(ctx context.Context, name, bin, dir string, args []string, stdin string) (string, error) {
	cmd := newCommand(bin, args)
	cmd.Dir = dir
	cmd.Env = withWorkDir(dir)
	cmd.Stdin = strings.NewReader(stdin)
	setProcessGroup(cmd)
	var stdout, stderr bytes.Buffer
	cmd.Stdout = &stdout
	cmd.Stderr = &stderr
	if err := cmd.Start(); err != nil {
		return "", fmt.Errorf("無法啟動 %s", name)
	}
	done := make(chan error, 1)
	go func() { done <- cmd.Wait() }()
	select {
	case err := <-done:
		if err != nil {
			return stdout.String(), commandError(name, err, stderr.String())
		}
		return stdout.String(), nil
	case <-ctx.Done():
		killProcessGroup(cmd)
		<-done
		if errors.Is(ctx.Err(), context.DeadlineExceeded) {
			return "", fmt.Errorf("%s 超過 10 分鐘還沒有回答", name)
		}
		return "", fmt.Errorf("%s 已取消", name)
	}
}

// 繼承登入用的環境變數，但把 PWD 改到問答目錄，避免 CLI 沿用 Writer 啟動時的專案路徑。
func withWorkDir(dir string) []string {
	env := os.Environ()
	replaced := false
	for i, item := range env {
		if strings.HasPrefix(item, "PWD=") {
			env[i] = "PWD=" + dir
			replaced = true
		}
	}
	if !replaced {
		env = append(env, "PWD="+dir)
	}
	return env
}

func commandError(name string, err error, stderr string) error {
	detail := tail(ansi.ReplaceAllString(stderr, ""), 400)
	if detail == "" {
		return fmt.Errorf("%s 執行失敗：%w", name, err)
	}
	return fmt.Errorf("%s 執行失敗：%s", name, detail)
}

func tail(text string, n int) string {
	text = strings.TrimSpace(text)
	runes := []rune(text)
	if len(runes) <= n {
		return text
	}
	return string(runes[len(runes)-n:])
}

// 有些 CLI 會在 JSON 前面印警告，取最外層那個物件。
func jsonObject(stdout string) []byte {
	text := strings.TrimSpace(stdout)
	start := strings.IndexByte(text, '{')
	end := strings.LastIndexByte(text, '}')
	if start < 0 || end <= start {
		return nil
	}
	return []byte(text[start : end+1])
}
