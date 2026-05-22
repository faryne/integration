package discord

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"faryne.dev/config"
	"github.com/stretchr/testify/assert"
)

func TestServiceDiscord_SendMessage(t *testing.T) {
	t.Run("success", func(t *testing.T) {
		server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			assert.Equal(t, http.MethodPost, r.Method)
			assert.Equal(t, "application/json", r.Header.Get("Content-Type"))
			w.WriteHeader(http.StatusNoContent)
		}))
		defer server.Close()

		s := &ServiceDiscord{webhookURL: server.URL}
		err := s.SendMessage(t.Context(), "test message")
		assert.NoError(t, err)
	})

	t.Run("split long message", func(t *testing.T) {
		callCount := 0
		server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			callCount++
			w.WriteHeader(http.StatusNoContent)
		}))
		defer server.Close()

		s := &ServiceDiscord{webhookURL: server.URL}
		// Message > 1900 characters
		longMsg := ""
		for range 200 {
			longMsg += "this is a test line that is exactly 20 characters long\n"
		}
		// total length = 200 * 55 = 11000 characters
		err := s.SendMessage(t.Context(), longMsg)
		assert.NoError(t, err)
		assert.Greater(t, callCount, 1)
	})

	t.Run("missing webhook url", func(t *testing.T) {
		s := &ServiceDiscord{webhookURL: ""}
		err := s.SendMessage(t.Context(), "test message")
		assert.Error(t, err)
		assert.Contains(t, err.Error(), "discord webhook URL is not configured")
	})

	t.Run("server error", func(t *testing.T) {
		server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			w.WriteHeader(http.StatusInternalServerError)
		}))
		defer server.Close()

		s := &ServiceDiscord{webhookURL: server.URL}
		err := s.SendMessage(t.Context(), "test message")
		assert.Error(t, err)
		assert.Contains(t, err.Error(), "discord responded with status: 500")
	})
}

func TestNewServiceDiscord(t *testing.T) {
	// Mock config
	config.InitEnvConfig()
	s := NewServiceDiscord()
	assert.NotNil(t, s)
}
