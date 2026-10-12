//go:build darwin

package updater

import (
	"crypto/sha256"
	"fmt"
	"os"
	"path/filepath"
	"testing"
)

func TestVerifyChecksum(t *testing.T) {
	directory := t.TempDir()
	archive := filepath.Join(directory, "writer.zip")
	content := []byte("writer update")
	if err := os.WriteFile(archive, content, 0o600); err != nil {
		t.Fatal(err)
	}
	checksum := filepath.Join(directory, "checksums.txt")
	line := fmt.Sprintf("%x  writer.zip\n", sha256.Sum256(content))
	if err := os.WriteFile(checksum, []byte(line), 0o600); err != nil {
		t.Fatal(err)
	}
	if err := verifyChecksum(archive, checksum); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(checksum, []byte(fmt.Sprintf("%064d  writer.zip\n", 0)), 0o600); err != nil {
		t.Fatal(err)
	}
	if err := verifyChecksum(archive, checksum); err == nil {
		t.Fatal("checksum 不相符時應拒絕更新")
	}
}
