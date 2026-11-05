package firebaseauth

import (
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"net/http/httptest"
	"testing"
)

// fakeIdentityToolkit 模擬 Identity Toolkit：依 path 回固定內容，記下收到的 body 與 key
func fakeIdentityToolkit(t *testing.T, status int, response string) (*Client, *map[string]any) {
	t.Helper()
	received := map[string]any{}
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Query().Get("key") != "test-key" {
			t.Errorf("api key = %q", r.URL.Query().Get("key"))
		}
		_ = json.NewDecoder(r.Body).Decode(&received)
		received["_path"] = r.URL.Path
		w.WriteHeader(status)
		_, _ = w.Write([]byte(response))
	}))
	t.Cleanup(server.Close)
	return NewWith(server.URL+"/", "test-key"), &received
}

func TestSignUpSuccess(t *testing.T) {
	c, received := fakeIdentityToolkit(t, http.StatusOK, `{"localId":"uid-1","email":"a@example.com","idToken":"tok"}`)
	account, err := c.SignUp(context.Background(), "a@example.com", "secret1")
	if err != nil || account.LocalID != "uid-1" || account.IDToken != "tok" {
		t.Fatalf("account = %+v, err = %v", account, err)
	}
	if (*received)["_path"] != "/v1/accounts:signUp" || (*received)["returnSecureToken"] != true {
		t.Fatalf("request = %+v", *received)
	}
}

func TestErrorCodeParsing(t *testing.T) {
	cases := []struct {
		message string
		check   func(error) bool
	}{
		{"WEAK_PASSWORD : Password should be at least 6 characters", func(err error) bool { return IsCode(err, CodeWeakPassword) }},
		{"EMAIL_EXISTS", func(err error) bool { return IsCode(err, CodeEmailExists) }},
		{"INVALID_LOGIN_CREDENTIALS", IsInvalidCredentials},
		{"EMAIL_NOT_FOUND", IsInvalidCredentials},
		{"TOO_MANY_ATTEMPTS_TRY_LATER : Too many unsuccessful login attempts.", func(err error) bool { return IsCode(err, CodeTooManyAttempts) }},
	}
	for _, tc := range cases {
		c, _ := fakeIdentityToolkit(t, http.StatusBadRequest, `{"error":{"code":400,"message":"`+tc.message+`"}}`)
		_, err := c.SignIn(context.Background(), "a@example.com", "x")
		if !tc.check(err) {
			t.Fatalf("message %q: err = %v", tc.message, err)
		}
	}
}

func TestNotConfigured(t *testing.T) {
	if _, err := NewWith("http://unused", "").SignIn(context.Background(), "a@example.com", "x"); !errors.Is(err, ErrNotConfigured) {
		t.Fatalf("err = %v", err)
	}
}

func TestConfirmEmailVerification(t *testing.T) {
	c, received := fakeIdentityToolkit(t, http.StatusOK, `{"email":"a@example.com","emailVerified":true}`)
	email, _, err := c.ConfirmEmailVerification(context.Background(), "code-1")
	if err != nil || email != "a@example.com" || (*received)["oobCode"] != "code-1" || (*received)["_path"] != "/v1/accounts:update" {
		t.Fatalf("email = %q, err = %v, request = %+v", email, err, *received)
	}
}
