package updater

import "testing"

func TestAssetPattern(t *testing.T) {
	tests := []struct {
		goos, goarch, expected string
	}{
		{"darwin", "arm64", `^steamloom-writer-macos-universal\.zip$`},
		{"windows", "amd64", `^steamloom-writer-windows-amd64\.zip$`},
		{"linux", "arm64", `^steamloom-writer-linux-arm64\.tar\.gz$`},
	}
	for _, test := range tests {
		if actual := assetPattern(test.goos, test.goarch); actual != test.expected {
			t.Errorf("assetPattern(%q, %q) = %q，預期 %q", test.goos, test.goarch, actual, test.expected)
		}
	}
}
