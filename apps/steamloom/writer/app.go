package main

import (
	"context"
	"log"

	"faryne.dev/apps/steamloom/writer/internal/api"
	"faryne.dev/apps/steamloom/writer/internal/auth"
	"faryne.dev/apps/steamloom/writer/internal/config"
	"faryne.dev/apps/steamloom/writer/internal/tokenstore"
	"github.com/wailsapp/wails/v2/pkg/runtime"
)

// App 的公開方法會由 Wails 綁定給前端呼叫（frontend/wailsjs/go/main/App）。
// 錯誤以字串傳到前端；auth.ErrNotLoggedIn／ErrLoginCanceled 的訊息是固定代碼，前端據此切畫面。
type App struct {
	ctx     context.Context
	session *auth.Session
	api     *api.Client
}

func NewApp() *App {
	cfg := config.Load()
	app := &App{}
	app.session = auth.New(cfg, tokenstore.New(cfg.Issuer), func(url string) {
		// 授權網址也印到 log，瀏覽器沒有自動打開時可以手動複製
		log.Printf("open authorize url: %s", url)
		runtime.BrowserOpenURL(app.ctx, url)
	})
	app.api = api.New(cfg.APIBase, app.session)
	return app
}

func (a *App) startup(ctx context.Context) { a.ctx = ctx }

// Me 回傳目前登入的作者；沒登入時回 ErrNotLoggedIn，前端顯示登入畫面。
func (a *App) Me() (*api.Profile, error) { return a.api.Me(a.ctx) }

// Login 開瀏覽器走 OAuth 授權；只負責拿到憑證，作者資料由前端另外呼叫 Me 載入，
// 這樣「授權成功但 API 失敗」不會被當成登入失敗。
func (a *App) Login() error { return a.session.Login(a.ctx) }

func (a *App) CancelLogin() { a.session.CancelLogin() }

func (a *App) Logout() error { return a.session.Logout(a.ctx) }

func (a *App) Projects() ([]api.Project, error) { return a.api.Projects(a.ctx) }

// Workspace 回傳專案工作台側邊列的樹狀資料（冊／故事、設定集／設定、資產集）。
func (a *App) Workspace(project string) (*api.Workspace, error) {
	return a.api.Workspace(a.ctx, project)
}

// Document 回傳單篇故事或設定，kind 是 "story" 或 "lore"（綁定參數用 string，Wails 不會產生 Go 自訂型別的 TS 定義）。
func (a *App) Document(project, kind, id string) (*api.Document, error) {
	return a.api.Document(a.ctx, project, api.DocumentKind(kind), id)
}

// Versions 回傳單篇故事或設定的編輯歷史（不含內文）。
func (a *App) Versions(project, kind, id string) ([]api.Version, error) {
	return a.api.Versions(a.ctx, project, api.DocumentKind(kind), id)
}

// VersionDetail 回傳單一版本的完整內容（標題、摘要、內文），給版本比對用。
func (a *App) VersionDetail(project, kind, id, versionID string) (*api.VersionDetail, error) {
	return a.api.VersionDetail(a.ctx, project, api.DocumentKind(kind), id, versionID)
}
