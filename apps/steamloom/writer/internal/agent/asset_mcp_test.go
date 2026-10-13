package agent

import (
	"bytes"
	"strings"
	"testing"
)

func TestAssetMCPAdvertisesOnlyApprovedUploadTool(t *testing.T) {
	input := strings.NewReader("{\"jsonrpc\":\"2.0\",\"id\":1,\"method\":\"initialize\"}\n{\"jsonrpc\":\"2.0\",\"id\":2,\"method\":\"tools/list\"}\n")
	var output bytes.Buffer
	if err := ServeAssetMCP(input, &output, "grok", "project", "thread", "proposal", "grant"); err != nil {
		t.Fatal(err)
	}
	text := output.String()
	if !strings.Contains(text, assetMCPToolName) || strings.Contains(text, "storyteller_") || strings.Contains(text, "shell") {
		t.Fatalf("asset MCP exposed unexpected capabilities: %s", text)
	}
}

func TestValidatePresignedUploadURL(t *testing.T) {
	valid := "https://bucket.s3.ap-northeast-1.amazonaws.com/key?X-Amz-Signature=sig&X-Amz-Credential=credential&X-Amz-Expires=900"
	if _, err := validatePresignedUploadURL(valid); err != nil {
		t.Fatal(err)
	}
	for _, raw := range []string{
		"http://bucket.s3.amazonaws.com/key?X-Amz-Signature=sig&X-Amz-Credential=c&X-Amz-Expires=1",
		"https://evil.example/key?X-Amz-Signature=sig&X-Amz-Credential=c&X-Amz-Expires=1",
		"https://bucket.s3.amazonaws.com/key",
	} {
		if _, err := validatePresignedUploadURL(raw); err == nil {
			t.Fatalf("unsafe upload URL was accepted: %s", raw)
		}
	}
}
