package updater

import (
	"testing"

	selfupdate "github.com/creativeprojects/go-selfupdate"
)

func TestUpdaterUsesAlphaChannelAndChecksumValidator(t *testing.T) {
	validator := &selfupdate.ChecksumValidator{UniqueFilename: "checksums.txt"}
	config := updaterConfig([]string{"asset"}, validator)
	if !config.Prerelease || len(config.Filters) != 1 || config.Filters[0] != "asset" || config.Validator != validator {
		t.Fatalf("alpha updater config is incomplete: %#v", config)
	}
}

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
