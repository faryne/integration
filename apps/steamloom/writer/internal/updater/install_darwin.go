//go:build darwin

package updater

import (
	"bufio"
	"context"
	"crypto/sha256"
	"fmt"
	"io"
	"net/http"
	"os"
	"os/exec"
	"path/filepath"
	"strconv"
	"strings"

	selfupdate "github.com/creativeprojects/go-selfupdate"
)

const macUpdateScript = `#!/bin/sh
pid="$1"
current="$2"
staged="$3"
work="$4"
backup="$work/previous.app"

while kill -0 "$pid" 2>/dev/null; do sleep 0.2; done
if ! mv "$current" "$backup"; then
  open -n "$current"
  rm -rf "$work"
  exit 1
fi
if mv "$staged" "$current"; then
  rm -rf "$backup"
  open -n "$current"
else
  rm -rf "$current"
  mv "$backup" "$current"
  open -n "$current"
fi
rm -rf "$work"
`

// macOS 必須替換整個已簽章的 .app；只換 binary 會讓 bundle signature 失效。
func applyUpdate(ctx context.Context, _ *selfupdate.Updater, release *selfupdate.Release) error {
	current, err := appBundlePath()
	if err != nil {
		return err
	}
	probe, err := os.CreateTemp(filepath.Dir(current), ".steamloom-writer-update-")
	if err != nil {
		return fmt.Errorf("Writer 所在目錄沒有更新權限：%w", err)
	}
	_ = probe.Close()
	_ = os.Remove(probe.Name())
	work, err := os.MkdirTemp("", "steamloom-writer-update-")
	if err != nil {
		return err
	}
	cleanup := true
	defer func() {
		if cleanup {
			_ = os.RemoveAll(work)
		}
	}()

	archive := filepath.Join(work, release.AssetName)
	if err := download(ctx, release.AssetURL, archive); err != nil {
		return err
	}
	checksum := filepath.Join(work, "checksums.txt")
	if err := download(ctx, release.ValidationAssetURL, checksum); err != nil {
		return err
	}
	if err := verifyChecksum(archive, checksum); err != nil {
		return err
	}
	if err := exec.CommandContext(ctx, "ditto", "-x", "-k", archive, work).Run(); err != nil {
		return fmt.Errorf("解壓縮 macOS 更新失敗：%w", err)
	}
	staged := filepath.Join(work, "SteamLoom Writer.app")
	if err := exec.CommandContext(ctx, "codesign", "--verify", "--deep", "--strict", staged).Run(); err != nil {
		return fmt.Errorf("macOS 更新簽章驗證失敗：%w", err)
	}

	script := filepath.Join(work, "install.sh")
	if err := os.WriteFile(script, []byte(macUpdateScript), 0o700); err != nil {
		return err
	}
	if err := exec.Command("/bin/sh", script, strconv.Itoa(os.Getpid()), current, staged, work).Start(); err != nil {
		return fmt.Errorf("啟動 macOS 更新程序失敗：%w", err)
	}
	cleanup = false
	return nil
}

func appBundlePath() (string, error) {
	bundle := filepath.Clean(filepath.Join(filepath.Dir(executablePath()), "..", ".."))
	if !strings.HasSuffix(bundle, ".app") {
		return "", fmt.Errorf("目前 Writer 不是從 macOS app bundle 執行")
	}
	return bundle, nil
}

func download(ctx context.Context, url, destination string) error {
	request, err := http.NewRequestWithContext(ctx, http.MethodGet, url, nil)
	if err != nil {
		return err
	}
	request.Header.Set("User-Agent", "SteamLoom-Writer-Updater")
	response, err := http.DefaultClient.Do(request)
	if err != nil {
		return fmt.Errorf("下載更新失敗：%w", err)
	}
	defer response.Body.Close()
	if response.StatusCode != http.StatusOK {
		return fmt.Errorf("下載更新失敗（HTTP %d）", response.StatusCode)
	}
	file, err := os.Create(destination)
	if err != nil {
		return err
	}
	defer file.Close()
	if _, err := io.Copy(file, response.Body); err != nil {
		return fmt.Errorf("儲存更新失敗：%w", err)
	}
	return nil
}

func verifyChecksum(archive, checksumFile string) error {
	file, err := os.Open(archive)
	if err != nil {
		return err
	}
	hash := sha256.New()
	if _, err := io.Copy(hash, file); err != nil {
		_ = file.Close()
		return err
	}
	_ = file.Close()

	checksums, err := os.Open(checksumFile)
	if err != nil {
		return err
	}
	defer checksums.Close()
	wantName, actual := filepath.Base(archive), fmt.Sprintf("%x", hash.Sum(nil))
	scanner := bufio.NewScanner(checksums)
	for scanner.Scan() {
		fields := strings.Fields(scanner.Text())
		if len(fields) == 2 && fields[1] == wantName {
			if fields[0] != actual {
				return fmt.Errorf("更新檔 SHA-256 驗證失敗")
			}
			return nil
		}
	}
	if err := scanner.Err(); err != nil {
		return err
	}
	return fmt.Errorf("checksums.txt 找不到 %s", wantName)
}
