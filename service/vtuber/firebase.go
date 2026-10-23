package vtuber

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"os"
	"strings"
	"sync"

	"golang.org/x/oauth2"
	"golang.org/x/oauth2/google"

	"faryne.dev/config"
)

// errNotConfigured 沒設 VTUBER_GOOGLE_CREDENTIALS／VTUBER_FIREBASE_DATABASE_URL（例如本機），行事曆同步直接略過
var errNotConfigured = errors.New("vtuber google credentials or firebase database url is not configured")

var (
	credentialsOnce sync.Once
	credentialsJSON []byte
	credentialsErr  error
)

// googleCredentials 讀 service account JSON；Firebase RTDB 與 Google Calendar 共用同一把
func googleCredentials() ([]byte, error) {
	credentialsOnce.Do(func() {
		path := strings.TrimSpace(config.EnvConfig().VtuberGoogleCredentials)
		if path == "" || strings.TrimSpace(config.EnvConfig().VtuberFirebaseDatabaseURL) == "" {
			credentialsErr = errNotConfigured
			return
		}
		credentialsJSON, credentialsErr = os.ReadFile(path)
	})
	return credentialsJSON, credentialsErr
}

// firebaseDB 用 RTDB REST API 讀寫；只有 service account 能存取（security rules 全擋）
type firebaseDB struct {
	baseURL string
	http    *http.Client
}

var (
	firebaseOnce   sync.Once
	firebaseClient *firebaseDB
	firebaseErr    error
)

func newFirebaseDB() (*firebaseDB, error) {
	firebaseOnce.Do(func() {
		data, err := googleCredentials()
		if err != nil {
			firebaseErr = err
			return
		}
		// token source 會自己換新 access token，所以用 Background 而不是單次 job 的 ctx
		creds, err := google.CredentialsFromJSONWithType(context.Background(), data, google.ServiceAccount,
			"https://www.googleapis.com/auth/firebase.database", "https://www.googleapis.com/auth/userinfo.email")
		if err != nil {
			firebaseErr = fmt.Errorf("load firebase credentials: %w", err)
			return
		}
		firebaseClient = &firebaseDB{baseURL: strings.TrimRight(config.EnvConfig().VtuberFirebaseDatabaseURL, "/"), http: oauth2.NewClient(context.Background(), creds.TokenSource)}
	})
	return firebaseClient, firebaseErr
}

// get 讀 path 的內容到 out；節點不存在時 RTDB 回 null，out 維持零值
func (f *firebaseDB) get(ctx context.Context, path string, out any) error {
	body, err := f.do(ctx, http.MethodGet, path, nil)
	if err != nil {
		return err
	}
	return json.Unmarshal(body, out)
}

// put 整個覆蓋 path
func (f *firebaseDB) put(ctx context.Context, path string, value any) error {
	_, err := f.do(ctx, http.MethodPut, path, value)
	return err
}

// patch 只更新給的子節點；值為 nil 的子節點會被刪除
func (f *firebaseDB) patch(ctx context.Context, path string, values map[string]any) error {
	_, err := f.do(ctx, http.MethodPatch, path, values)
	return err
}

func (f *firebaseDB) do(ctx context.Context, method, path string, payload any) ([]byte, error) {
	var reader io.Reader
	if payload != nil {
		body, err := json.Marshal(payload)
		if err != nil {
			return nil, err
		}
		reader = bytes.NewReader(body)
	}
	req, err := http.NewRequestWithContext(ctx, method, f.baseURL+"/"+path+".json", reader)
	if err != nil {
		return nil, err
	}
	resp, err := f.http.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()
	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, err
	}
	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("firebase %s %s: %s %s", method, path, resp.Status, strings.TrimSpace(string(body)))
	}
	return body, nil
}
