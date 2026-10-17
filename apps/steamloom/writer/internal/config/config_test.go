package config

import "testing"

// 網站網址：有 STEAMLOOM_WEB_URL 用它；沒有就取授權頁 origin（本機是 vite 的 5174，不是後端 8080）；正式站預設 steamloom.works。
func TestWebURL(t *testing.T) {
	cases := []struct {
		name string
		env  map[string]string
		want string
	}{
		{"production default", nil, "https://steamloom.works"},
		{"local dev from authorize url", map[string]string{"STEAMLOOM_ISSUER": "http://localhost:8080", "STEAMLOOM_AUTHORIZE_URL": "http://localhost:5174/storyteller/oauth/authorize"}, "http://localhost:5174"},
		{"explicit override", map[string]string{"STEAMLOOM_WEB_URL": "http://site.test/", "STEAMLOOM_AUTHORIZE_URL": "http://localhost:5174/x"}, "http://site.test"},
	}
	for _, c := range cases {
		for _, key := range []string{"STEAMLOOM_ISSUER", "STEAMLOOM_AUTHORIZE_URL", "STEAMLOOM_WEB_URL"} {
			t.Setenv(key, c.env[key])
		}
		if got := Load().WebURL; got != c.want {
			t.Fatalf("%s: WebURL = %q, want %q", c.name, got, c.want)
		}
	}
}
