//go:build !darwin

package updater

import (
	"context"

	selfupdate "github.com/creativeprojects/go-selfupdate"
)

// Windows／Linux 可安全替換正在執行的 binary；library 失敗時會自動回復舊檔。
func applyUpdate(ctx context.Context, client *selfupdate.Updater, release *selfupdate.Release) error {
	return client.UpdateTo(ctx, release, executablePath())
}
