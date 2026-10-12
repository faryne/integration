//go:build unix

package agent

import (
	"os/exec"
	"syscall"
)

func newCommand(path string, args []string) *exec.Cmd {
	return exec.Command(path, args...)
}

func setProcessGroup(cmd *exec.Cmd) {
	cmd.SysProcAttr = &syscall.SysProcAttr{Setpgid: true}
}

func killProcessGroup(cmd *exec.Cmd) {
	if cmd.Process == nil {
		return
	}
	// 負的 pid 是整個 process group，工具程序才不會在取消後留下來
	_ = syscall.Kill(-cmd.Process.Pid, syscall.SIGKILL)
	_ = cmd.Process.Kill()
}
