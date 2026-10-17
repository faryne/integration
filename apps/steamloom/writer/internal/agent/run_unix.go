//go:build unix

package agent

import (
	"os/exec"
	"syscall"
	"time"
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
	pgid := cmd.Process.Pid
	_ = syscall.Kill(-pgid, syscall.SIGKILL)
	_ = cmd.Process.Kill()
	// macOS 上 group kill 若剛好撞上 fork，新生的子程序會漏收訊號、變成孤兒繼續持有 stdout/stderr pipe，
	// Wait 只能等它自然結束。短時間內補打幾次，直到 group 裡沒有程序（ESRCH）為止。
	go func() {
		for range 20 {
			time.Sleep(50 * time.Millisecond)
			if syscall.Kill(-pgid, syscall.SIGKILL) != nil {
				return
			}
		}
	}()
}
