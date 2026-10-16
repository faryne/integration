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
	"sync"
	"sync/atomic"
)

// 解析不到回答，而且 CLI 也沒給自己的錯誤說明時用。真正的執行失敗優先顯示 stderr。
var errNoResult = errors.New("沒有取得回答")

// outputError 是 CLI 已經用它自己的格式說明失敗；比 stderr 的雜訊優先顯示。
type outputError struct{ msg string }

func (e outputError) Error() string { return e.msg }

var ansi = regexp.MustCompile(`\x1b\[[0-9;]*[A-Za-z]`)

type invocation struct {
	name    string
	bin     string
	dir     string
	args    []string
	stdin   string
	decoder protocolDecoder
	emit    func(StreamEvent)
	resume  string
}

func invoke(ctx context.Context, call invocation) (Reply, error) {
	if call.decoder == nil {
		return Reply{}, errors.New("Agent adapter 沒有設定輸出協定")
	}
	state := newProtocolState(call.resume, call.emit)
	// stdout 與 stderr 由不同 goroutine 讀取，共用的 protocol state 要串行更新。
	var mu sync.Mutex
	consume := func(events []protocolEvent) bool {
		mu.Lock()
		defer mu.Unlock()
		return state.Consume(events)
	}
	var consumeErr func(string) bool
	if decoder, ok := call.decoder.(stderrDecoder); ok {
		consumeErr = func(line string) bool { return consume(decoder.DecodeStderr(line)) }
	}
	_, runErr := run(ctx, call.name, call.bin, call.dir, call.args, call.stdin, func(line string) bool {
		return consume(call.decoder.Decode(line))
	}, consumeErr)
	if ctx.Err() != nil {
		if runErr != nil {
			return Reply{}, runErr
		}
		return Reply{}, ctx.Err()
	}
	reply, parseErr := state.Reply()
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
	// 中斷程序本身會讓 CLI 以非 0 結束；MCP 不可用才是真正原因，優先回報。
	var unavailable *MCPUnavailableError
	if errors.As(parseErr, &unavailable) {
		return Reply{}, unavailable
	}
	if runErr != nil {
		return Reply{}, runErr
	}
	return Reply{}, parseErr
}

func run(ctx context.Context, name, bin, dir string, args []string, stdin string, consume, consumeErr func(string) bool) (string, error) {
	cmd := newCommand(bin, args)
	cmd.Dir = dir
	cmd.Env = withWorkDir(dir)
	cmd.Stdin = strings.NewReader(stdin)
	setProcessGroup(cmd)
	var stderrTerminal atomic.Bool
	stderr := &lineWriter{onLine: consumeErr, stop: func() {
		stderrTerminal.Store(true)
		killProcessGroup(cmd)
	}}
	stdout, err := cmd.StdoutPipe()
	if err != nil {
		return "", fmt.Errorf("無法讀取 %s 輸出", name)
	}
	cmd.Stderr = stderr
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
			if !terminal && consume != nil && consume(line) {
				terminal = true
				killProcessGroup(cmd)
			}
		}
		scanErr := scanner.Err()
		waitErr := cmd.Wait()
		if terminal || stderrTerminal.Load() {
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
			return result.stdout, fmt.Errorf("%s 等待逾時，已中斷", name)
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
	if (name == "Gemini CLI" || name == "Antigravity") && providerLoginRequired(detail) {
		command := "gemini"
		if name == "Antigravity" {
			command = "agy"
		}
		return fmt.Errorf("%s 尚未登入，請先在 Terminal 執行 `%s` 完成登入後再試", name, command)
	}
	return fmt.Errorf("%s 執行失敗：%s", name, detail)
}

func providerLoginRequired(detail string) bool {
	lower := strings.ToLower(detail)
	for _, phrase := range []string{
		"authentication required", "failed to authenticate", "not authenticated", "not logged in",
		"login required", "please login", "please log in", "auth method", "credentials not found",
	} {
		if strings.Contains(lower, phrase) {
			return true
		}
	}
	return false
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
