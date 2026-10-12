package updater

import (
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"runtime"
	"strings"
)

func executablePath() string {
	path, err := os.Executable()
	if err != nil {
		return os.Args[0]
	}
	return path
}

// Restart 啟動更新後的執行檔；macOS 優先透過 open 開啟整個 app bundle。
func Restart() error {
	executable := executablePath()
	if runtime.GOOS == "darwin" {
		bundle := filepath.Clean(filepath.Join(filepath.Dir(executable), "..", ".."))
		if strings.HasSuffix(bundle, ".app") {
			return exec.Command("open", "-n", bundle).Start()
		}
	}
	if err := exec.Command(executable).Start(); err != nil {
		return fmt.Errorf("重新啟動 Writer 失敗：%w", err)
	}
	return nil
}
