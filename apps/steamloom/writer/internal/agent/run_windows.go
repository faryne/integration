//go:build windows

package agent

import (
	"os/exec"
	"strconv"
	"strings"
	"syscall"
)

// CREATE_NO_WINDOW：GUI app 呼叫 console CLI 時不要閃出命令列視窗。
const createNoWindow = 0x08000000

func newCommand(path string, args []string) *exec.Cmd {
	lower := strings.ToLower(path)
	if strings.HasSuffix(lower, ".cmd") || strings.HasSuffix(lower, ".bat") {
		// CreateProcess 不能直接跑 .cmd，要交給 cmd.exe；空字串參數也得保留成 ""
		parts := make([]string, 0, 1+len(args))
		parts = append(parts, quoteCmd(path))
		for _, arg := range args {
			parts = append(parts, quoteCmd(arg))
		}
		cmd := exec.Command("cmd.exe", "/d", "/s", "/c", strings.Join(parts, " "))
		cmd.SysProcAttr = &syscall.SysProcAttr{HideWindow: true, CreationFlags: createNoWindow}
		return cmd
	}
	return exec.Command(path, args...)
}

func quoteCmd(value string) string {
	if value == "" {
		return `""`
	}
	if !strings.ContainsAny(value, " \t\"") {
		return value
	}
	return `"` + strings.ReplaceAll(value, `"`, `""`) + `"`
}

func setProcessGroup(cmd *exec.Cmd) {
	if cmd.SysProcAttr == nil {
		cmd.SysProcAttr = &syscall.SysProcAttr{}
	}
	cmd.SysProcAttr.HideWindow = true
	cmd.SysProcAttr.CreationFlags |= createNoWindow
}

func killProcessGroup(cmd *exec.Cmd) {
	if cmd.Process == nil {
		return
	}
	kill := exec.Command("taskkill", "/T", "/F", "/PID", strconv.Itoa(cmd.Process.Pid))
	kill.SysProcAttr = &syscall.SysProcAttr{HideWindow: true, CreationFlags: createNoWindow}
	_ = kill.Run()
	_ = cmd.Process.Kill()
}
