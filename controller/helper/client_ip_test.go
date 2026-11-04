package helper

import (
	"net"
	"testing"

	"github.com/stretchr/testify/require"
)

func TestClientIPFallsBackToRemoteIPWithoutProxyHeader(t *testing.T) {
	require.Equal(t, "127.0.0.1", clientIP("", net.ParseIP("127.0.0.1")))
	require.Equal(t, "203.0.113.10", clientIP("203.0.113.10", net.ParseIP("127.0.0.1")))
	require.Equal(t, "", clientIP(" ", nil))
}
