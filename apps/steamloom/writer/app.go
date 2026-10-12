package main

import (
	"context"
	"log"
	goruntime "runtime"
	"time"

	"faryne.dev/apps/steamloom/writer/internal/agent"
	"faryne.dev/apps/steamloom/writer/internal/api"
	"faryne.dev/apps/steamloom/writer/internal/auth"
	"faryne.dev/apps/steamloom/writer/internal/config"
	"faryne.dev/apps/steamloom/writer/internal/skillupdate"
	"faryne.dev/apps/steamloom/writer/internal/tokenstore"
	appupdate "faryne.dev/apps/steamloom/writer/internal/updater"
	"github.com/wailsapp/wails/v2/pkg/runtime"
)

// App 的公開方法會由 Wails 綁定給前端呼叫（frontend/wailsjs/go/main/App）。
// 錯誤以字串傳到前端；auth.ErrNotLoggedIn／ErrLoginCanceled 的訊息是固定代碼，前端據此切畫面。
type App struct {
	ctx     context.Context
	session *auth.Session
	api     *api.Client
	updater *appupdate.Service
	skill   *skillupdate.Service
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
	app.skill = skillupdate.New(cfg.SkillURL)
	var err error
	app.updater, err = appupdate.New(version)
	if err != nil {
		panic(err)
	}
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

// Agents 回傳這台機器偵測得到的本機 AI CLI。沒安裝的不會出現在選單。
func (a *App) Agents() []agent.Installed { return agent.Detect() }

// McpInstalled 只看這個 Agent 的設定裡有沒有 SteamLoom 的 MCP 位址。沒有時附上使用者自己執行的安裝指令。
func (a *App) McpInstalled(agentID string) (agent.McpHint, error) {
	return agent.McpHintFor(agentID)
}

// ChatOpen 讀出這個專案在這個 Agent 底下、目前那一條對話的尾端。
func (a *App) ChatOpen(agentID, projectID string) (*agent.ChatPage, error) {
	return chatPage(agent.OpenChat(agentID, projectID))
}

// ChatSelect 改看同一個專案、同一個 Agent 的另一條串。
func (a *App) ChatSelect(agentID, projectID, threadID string) (*agent.ChatPage, error) {
	return chatPage(agent.SelectChat(agentID, projectID, threadID))
}

// ChatOlder 補上畫面上方更早的訊息。start 是目前畫面上最舊一則的索引。
func (a *App) ChatOlder(agentID, projectID, threadID string, start int) (*agent.OlderMessages, error) {
	older, err := agent.OlderChat(agentID, projectID, threadID, start)
	if err != nil {
		return nil, err
	}
	return &older, nil
}

// ChatNew 為了切開 context 開一條新串。舊串留在列表裡，還可以回去續聊。
func (a *App) ChatNew(agentID, projectID string) (*agent.ChatPage, error) {
	return chatPage(agent.NewChat(agentID, projectID))
}

// EnsureSkill 在「AI 助理」選擇工具、MCP 檢查之後呼叫：這個工具還沒有 Skill 就安裝，遠端較新就更新。
// Skill 的安裝與更新只有這一個入口，Writer 啟動時不會處理。
func (a *App) EnsureSkill(agentID string) (skillupdate.Result, error) {
	return a.skill.Ensure(a.ctx, agentID)
}

func chatPage(page agent.ChatPage, err error) (*agent.ChatPage, error) {
	if err != nil {
		return nil, err
	}
	return &page, nil
}

// Ask 把一輪問答交給 id 指定的 CLI，成功後把原文和回答接到這條串的檔案後面。
// 續聊用的 session 以檔案為準，不採前端傳來的值。
func (a *App) Ask(id string, req agent.Request) (*agent.Reply, error) {
	sessionID, err := agent.SessionOf(id, req.ProjectID, req.ThreadID)
	if err != nil {
		return nil, err
	}
	req.SessionID = sessionID
	reply, err := agent.Ask(a.ctx, id, req)
	if err != nil {
		return nil, err
	}
	saved, err := agent.SaveTurn(id, req.ProjectID, req.ThreadID, req.Prompt, reply.Text, reply.SessionID)
	if err != nil {
		return nil, err
	}
	reply.ThreadID = saved.ID
	reply.Title = saved.Title
	return &reply, nil
}

// CheckForUpdate 由前端啟動時呼叫；沒有新版時回傳 nil。
func (a *App) CheckForUpdate() (*appupdate.Info, error) { return a.updater.Check(a.ctx) }

// AppVersion 讓 About 顯示 release workflow 透過 ldflags 寫入的實際版號。
func (a *App) AppVersion() string { return version }

// InstallUpdate 驗證並替換 app；macOS helper 會在舊程序退出後接手重啟。
func (a *App) InstallUpdate() error {
	if err := a.updater.Install(a.ctx); err != nil {
		return err
	}
	if goruntime.GOOS != "darwin" {
		if err := appupdate.Restart(); err != nil {
			return err
		}
	}
	go func() {
		time.Sleep(500 * time.Millisecond)
		runtime.Quit(a.ctx)
	}()
	return nil
}

// VersionDetail 回傳單一版本的完整內容（標題、摘要、內文），給版本比對用。
func (a *App) VersionDetail(project, kind, id, versionID string) (*api.VersionDetail, error) {
	return a.api.VersionDetail(a.ctx, project, api.DocumentKind(kind), id, versionID)
}

// Create 是側邊列「建立」：故事、圖像作品、冊、設定、設定集、資產集，比照網站的建立選單。
func (a *App) Create(project string, req api.CreateRequest) (*api.Created, error) {
	return a.api.Create(a.ctx, project, req)
}

// MoveStory 把故事移到某一冊（空字串＝未分冊）；不寫版本，只記 audit。
func (a *App) MoveStory(project, story, volume string) error {
	return a.api.MoveStory(a.ctx, project, story, volume)
}

// MoveLore 把設定移到某個設定集（空字串＝未歸類）。
func (a *App) MoveLore(project, lore, collection string) error {
	return a.api.MoveLore(a.ctx, project, lore, collection)
}

// Reorder 依 ids 順序重設排序；kind 是 volumes／stories／lore-collections。故事與冊不寫版本，只記 audit。
func (a *App) Reorder(project, kind string, ids []string) error {
	return a.api.Reorder(a.ctx, project, kind, ids)
}
