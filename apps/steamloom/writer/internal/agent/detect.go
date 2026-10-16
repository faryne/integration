package agent

import (
	"os"
	"os/exec"
	"path/filepath"
	"runtime"
)

// Detect 回傳這台機器找得到的 AI CLI。桌面 app 的 PATH 通常很瘦，所以除了 PATH 也看各家常見的安裝位置。
func Detect() []Installed {
	found := make([]Installed, 0)
	for _, item := range catalog {
		path, ok := lookup(item.executable)
		if !ok {
			continue
		}
		found = append(found, Installed{ID: item.descriptor.ID, DisplayName: item.descriptor.DisplayName, Path: path, Capabilities: append([]Capability(nil), item.descriptor.Capabilities...)})
	}
	return found
}

func lookup(name string) (string, bool) {
	if path, err := exec.LookPath(name); err == nil && isExecutable(path) {
		return path, true
	}
	for _, path := range extraPaths(name) {
		if isExecutable(path) {
			return path, true
		}
	}
	return "", false
}

func isExecutable(path string) bool {
	info, err := os.Stat(path)
	if err != nil || info.IsDir() {
		return false
	}
	if runtime.GOOS == "windows" {
		return true
	}
	return info.Mode()&0o111 != 0
}

func extraPaths(name string) []string {
	home, _ := os.UserHomeDir()
	dirs := []string{}
	if home != "" {
		dirs = append(dirs,
			filepath.Join(home, ".local", "bin"),
			filepath.Join(home, ".grok", "bin"),
			filepath.Join(home, "bin"),
		)
	}
	switch runtime.GOOS {
	case "darwin":
		dirs = append(dirs, "/opt/homebrew/bin", "/usr/local/bin")
	case "linux":
		dirs = append(dirs, "/usr/local/bin", "/usr/bin")
	case "windows":
		if local := os.Getenv("LOCALAPPDATA"); local != "" {
			dirs = append(dirs, filepath.Join(local, "Programs"))
		}
		if appData := os.Getenv("APPDATA"); appData != "" {
			dirs = append(dirs, filepath.Join(appData, "npm"))
		}
	}
	var paths []string
	for _, dir := range dirs {
		for _, filename := range executableNames(name) {
			paths = append(paths, filepath.Join(dir, filename))
		}
	}
	return paths
}

func executableNames(name string) []string {
	if runtime.GOOS != "windows" {
		return []string{name}
	}
	// 原生安裝優先於 npm 的 .cmd
	return []string{name + ".exe", name + ".cmd", name + ".bat"}
}
