package agent

import (
	"bufio"
	"bytes"
	"context"
	"encoding/json"
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
	name     string
	bin      string
	dir      string
	args     []string
	stdin    string
	parse    func(stdout string) (Reply, error)
	stream   func(line string)
	complete func(line string) bool
	resume   string
}

func invoke(ctx context.Context, call invocation) (Reply, error) {
	stdout, runErr := run(ctx, call.name, call.bin, call.dir, call.args, call.stdin, call.stream, call.complete)
	if ctx.Err() != nil {
		if runErr != nil {
			return Reply{}, runErr
		}
		return Reply{}, ctx.Err()
	}
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

func run(ctx context.Context, name, bin, dir string, args []string, stdin string, stream func(string), complete func(string) bool) (string, error) {
	cmd := newCommand(bin, args)
	cmd.Dir = dir
	cmd.Env = withWorkDir(dir)
	cmd.Stdin = strings.NewReader(stdin)
	setProcessGroup(cmd)
	var stderr bytes.Buffer
	stdout, err := cmd.StdoutPipe()
	if err != nil {
		return "", fmt.Errorf("無法讀取 %s 輸出", name)
	}
	cmd.Stderr = &stderr
	if err := cmd.Start(); err != nil {
		return "", fmt.Errorf("無法啟動 %s", name)
	}
	type runResult struct {
		stdout string
		err    error
	}
	done := make(chan runResult, 1)
	go func() {
		var output strings.Builder
		terminal := false
		scanner := bufio.NewScanner(stdout)
		scanner.Buffer(make([]byte, 64*1024), 4*1024*1024)
		for scanner.Scan() {
			line := scanner.Text()
			output.WriteString(line)
			output.WriteByte('\n')
			if stream != nil {
				stream(line)
			}
			if !terminal && complete != nil && complete(line) {
				terminal = true
				killProcessGroup(cmd)
			}
		}
		scanErr := scanner.Err()
		waitErr := cmd.Wait()
		if terminal {
			waitErr = scanErr
		} else if waitErr == nil {
			waitErr = scanErr
		}
		done <- runResult{stdout: output.String(), err: waitErr}
	}()
	select {
	case result := <-done:
		if result.err != nil {
			return result.stdout, commandError(name, result.err, stderr.String())
		}
		return result.stdout, nil
	case <-ctx.Done():
		killProcessGroup(cmd)
		result := <-done
		if errors.Is(ctx.Err(), context.DeadlineExceeded) {
			return result.stdout, fmt.Errorf("%s 超過 10 分鐘還沒有回答", name)
		}
		return result.stdout, fmt.Errorf("%s 已取消", name)
	}
}

// runCombined 執行不含對話內容的短命令，保留 stdout／stderr 供呼叫端判斷 CLI 狀態。
func runCombined(ctx context.Context, bin, dir string, args ...string) (string, error) {
	cmd := newCommand(bin, args)
	cmd.Dir = dir
	cmd.Env = withWorkDir(dir)
	setProcessGroup(cmd)
	var output bytes.Buffer
	cmd.Stdout, cmd.Stderr = &output, &output
	if err := cmd.Start(); err != nil {
		return "", err
	}
	done := make(chan error, 1)
	go func() { done <- cmd.Wait() }()
	select {
	case err := <-done:
		return output.String(), err
	case <-ctx.Done():
		killProcessGroup(cmd)
		<-done
		return output.String(), ctx.Err()
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
	if name == "Claude Code" {
		lower := strings.ToLower(detail)
		if strings.Contains(lower, "oauth session expired") || strings.Contains(lower, "failed to authenticate") {
			return errors.New("Claude Code 登入已過期，請先在 Terminal 執行 `claude auth login` 後再試")
		}
	}
	if name == "Grok Build" && grokLoginRequired(detail) {
		return errors.New(grokLoginError)
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

// 有些 CLI 會在 JSON 前後印警告，逐個解碼並取最後一個完整的 top-level 物件。
// 不能直接從第一個 { 切到最後一個 }：warning 本身可能帶 JSON 或大括號。
func jsonObject(stdout string) []byte {
	data := []byte(strings.TrimSpace(stdout))
	var last []byte
	for offset := 0; offset < len(data); {
		start := bytes.IndexByte(data[offset:], '{')
		if start < 0 {
			break
		}
		start += offset
		decoder := json.NewDecoder(bytes.NewReader(data[start:]))
		var raw json.RawMessage
		if err := decoder.Decode(&raw); err != nil || len(raw) == 0 || raw[0] != '{' {
			offset = start + 1
			continue
		}
		last = append(last[:0], raw...)
		offset = start + int(decoder.InputOffset())
	}
	return last
}
