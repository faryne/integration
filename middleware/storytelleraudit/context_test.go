package storytelleraudit

import (
	"net"
	"testing"

	"github.com/stretchr/testify/require"
)

func TestRequestContextFallsBackToRemoteIPWithoutProxyHeader(t *testing.T) {
	require.Equal(t, "127.0.0.1", requestIP("", net.ParseIP("127.0.0.1")))
	require.Equal(t, "203.0.113.10", requestIP("203.0.113.10", net.ParseIP("127.0.0.1")))
}
