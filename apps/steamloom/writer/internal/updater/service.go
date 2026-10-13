// Package updater 負責從 GitHub Release 檢查、驗證並安裝 Writer 更新。
package updater

import (
	"context"
	"fmt"
	"runtime"
	"sync"

	"github.com/Masterminds/semver/v3"
	selfupdate "github.com/creativeprojects/go-selfupdate"
)

const (
	repository = "faryne/integration"
	tagPrefix  = "steamloom-writer-v"
)

// Info 是前端顯示更新確認視窗需要的版本資訊。
type Info struct {
	CurrentVersion string `json:"current_version"`
	Version        string `json:"version"`
}

type Service struct {
	currentVersion string
	detector       *selfupdate.Updater
	installer      *selfupdate.Updater
	pendingVersion string
	mu             sync.Mutex
}

func New(currentVersion string) (*Service, error) {
	filter := []string{assetPattern(runtime.GOOS, runtime.GOARCH)}
	detector, err := selfupdate.NewUpdater(updaterConfig(filter, nil))
	if err != nil {
		return nil, fmt.Errorf("初始化更新檢查失敗：%w", err)
	}
	installer, err := selfupdate.NewUpdater(updaterConfig(filter, &selfupdate.ChecksumValidator{UniqueFilename: "checksums.txt"}))
	if err != nil {
		return nil, fmt.Errorf("初始化更新服務失敗：%w", err)
	}
	return &Service{currentVersion: currentVersion, detector: detector, installer: installer}, nil
}

// Writer 目前是內測 alpha channel；安裝 alpha 後會繼續追蹤 GitHub prerelease。
func updaterConfig(filters []string, validator selfupdate.Validator) selfupdate.Config {
	return selfupdate.Config{Filters: filters, Validator: validator, Prerelease: true}
}

// Check 尋找適用目前平台的最新 Writer release；開發版不主動檢查。
func (s *Service) Check(ctx context.Context) (*Info, error) {
	current, err := semver.NewVersion(s.currentVersion)
	if err != nil {
		return nil, nil
	}

	release, found, err := s.detector.DetectLatest(ctx, selfupdate.ParseSlug(repository))
	if err != nil {
		return nil, fmt.Errorf("檢查 Writer 更新失敗：%w", err)
	}
	if !found || !release.GreaterThan(current.String()) {
		return nil, nil
	}

	s.mu.Lock()
	s.pendingVersion = release.Version()
	s.mu.Unlock()
	return &Info{
		CurrentVersion: current.String(),
		Version:        release.Version(),
	}, nil
}

// Install 只允許安裝同一次檢查取得且通過平台篩選的 release。
func (s *Service) Install(ctx context.Context) error {
	s.mu.Lock()
	version := s.pendingVersion
	s.mu.Unlock()
	if version == "" {
		return fmt.Errorf("找不到可安裝的 Writer 更新，請重新檢查")
	}
	release, found, err := s.installer.DetectVersion(ctx, selfupdate.ParseSlug(repository), tagPrefix+version)
	if err != nil {
		return fmt.Errorf("驗證 Writer %s 更新失敗：%w", version, err)
	}
	if !found {
		return fmt.Errorf("找不到 Writer %s 的更新檔或 checksums.txt", version)
	}
	if err := applyUpdate(ctx, s.installer, release); err != nil {
		return fmt.Errorf("安裝 Writer %s 失敗：%w", release.Version(), err)
	}
	return nil
}

func assetPattern(goos, goarch string) string {
	if goos == "darwin" {
		return `^steamloom-writer-macos-universal\.zip$`
	}
	extension := `tar\.gz`
	if goos == "windows" {
		extension = `zip`
	}
	return fmt.Sprintf(`^steamloom-writer-%s-%s\.%s$`, goos, goarch, extension)
}
