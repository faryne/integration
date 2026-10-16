package main

import (
	"context"
	"errors"
	"fmt"
	"log"
	goruntime "runtime"
	"sync"
	"sync/atomic"
	"time"

	"faryne.dev/apps/steamloom/writer/internal/agent"
	"faryne.dev/apps/steamloom/writer/internal/api"
	"faryne.dev/apps/steamloom/writer/internal/auth"
	"faryne.dev/apps/steamloom/writer/internal/config"
	"faryne.dev/apps/steamloom/writer/internal/mediaworker"
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
	tasks   *agent.TaskManager
	workers *mediaworker.Service
	// unsaved：編輯分頁有沒有未存檔的內容，由前端回報（見 unsaved.go）
	unsaved atomic.Bool
	// localImages：圖像作品選好但還沒上傳的本機圖檔（見 local_images.go）
	localImages localImages
	// recovery 只在每個專案首次開啟時執行，避免一般列表刷新把正在等待 REST API 的 apply 誤判為中斷。
	recoveryMu        sync.Mutex
	recoveredProjects map[string]bool
}

func NewApp() *App {
	cfg := config.Load()
	app := &App{recoveredProjects: map[string]bool{}}
	app.session = auth.New(cfg, tokenstore.New(cfg.Issuer), func(url string) {
		// 授權網址也印到 log，瀏覽器沒有自動打開時可以手動複製
		log.Printf("open authorize url: %s", url)
		runtime.BrowserOpenURL(app.ctx, url)
	})
	app.api = api.New(cfg.APIBase, app.session)
	app.skill = skillupdate.New(cfg.SkillURL)
	app.workers = mediaworker.NewDefault()
	var err error
	app.updater, err = appupdate.New(version)
	if err != nil {
		panic(err)
	}
	return app
}

func (a *App) startup(ctx context.Context) {
	a.ctx = ctx
	a.tasks = agent.NewTaskManager(ctx, agent.Ask, func(event agent.TaskEvent) {
		runtime.EventsEmit(ctx, agent.TaskEventName, event)
	})
	a.tasks.SetProposalApplyRunner(a.applyProposal)
	a.tasks.SetProposalPrepareRunner(a.prepareProposal)
}

func (a *App) shutdown(context.Context) {
	if a.tasks != nil {
		a.tasks.Close()
	}
}

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

// DeleteDocument 刪除故事或設定（列表 ⋮ 選單，前端先輸入名稱確認）。
func (a *App) DeleteDocument(project, kind, id string) error {
	return a.api.DeleteDocument(a.ctx, project, api.DocumentKind(kind), id)
}

// PatchDocument 即時改狀態／冊（設定集）／署名，不寫版本、不進編輯歷史。
func (a *App) PatchDocument(project, kind, id string, patch api.AttributePatch) error {
	return a.api.PatchDocument(a.ctx, project, api.DocumentKind(kind), id, patch)
}

// SaveDocument 存檔故事或設定（每次一個新版本），回傳新的版本 id 與是否跟別處的修改衝突。
func (a *App) SaveDocument(project, kind, id string, input api.SaveInput) (*api.SaveResult, error) {
	return a.api.SaveDocument(a.ctx, project, api.DocumentKind(kind), id, input)
}

// Lores／Asset 給編輯器用：連結到設定的選單、失效設定連結的標示、內文資產圖片的預覽網址。
func (a *App) Lores(project string) ([]api.EditorLore, error) { return a.api.Lores(a.ctx, project) }

func (a *App) Asset(project, id string) (*api.EditorAsset, error) {
	return a.api.Asset(a.ctx, project, id)
}

// Versions 回傳單篇故事或設定的編輯歷史（不含內文）。
func (a *App) Versions(project, kind, id string) ([]api.Version, error) {
	return a.api.Versions(a.ctx, project, api.DocumentKind(kind), id)
}

// Agents 回傳這台機器偵測得到的本機 AI CLI。沒安裝的不會出現在選單。
func (a *App) Agents() []agent.Installed { return agent.Detect() }

// WorkerAdapters 回傳實際註冊的媒體 Worker adapter；設定頁不維護另一份寫死清單。
func (a *App) WorkerAdapters() []mediaworker.AdapterDescriptor { return a.workers.Adapters() }

// Workers 回傳這台裝置的全域 Worker 設定；密鑰只會以 has_secrets 告知是否存在。
func (a *App) Workers() ([]mediaworker.Worker, error) { return a.workers.Workers() }

func (a *App) SaveWorker(input mediaworker.SaveInput) (*mediaworker.Worker, error) {
	return a.workers.Save(input)
}

func (a *App) TestWorker(id string) (*mediaworker.Worker, error) {
	return a.workers.Test(a.ctx, id)
}

func (a *App) DeleteWorker(id string) error { return a.workers.Delete(id) }

// WorkerJobSpec 提供動態 job 表單；只包含 discovery schema，不含連線設定與密鑰。
func (a *App) WorkerJobSpec(id string) (*mediaworker.JobSpec, error) { return a.workers.JobSpec(id) }

// CodexModels 由本機 Codex app-server 取得 model 與各自支援的 reasoning effort。
func (a *App) CodexModels() ([]agent.CodexModel, error) { return agent.CodexModels(a.ctx) }

// McpInstalled 只看這個 Agent 的設定裡有沒有 SteamLoom 的 MCP 位址。沒有時附上使用者自己執行的安裝指令。
func (a *App) McpInstalled(agentID string) (agent.McpHint, error) {
	return agent.McpHintFor(agentID)
}

// ChatOpen 讀出這個專案在這個 Agent 底下、目前那一條對話的尾端。
func (a *App) ChatOpen(agentID, projectID string) (*agent.ChatPage, error) {
	if err := a.recoverInterruptedApplies(projectID); err != nil {
		return nil, err
	}
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

// ChatRename 只更新 Writer 的 thread 標題，不修改 Agent provider session。
func (a *App) ChatRename(agentID, projectID, threadID, title string) (*agent.ChatPage, error) {
	return chatPage(agent.RenameChat(agentID, projectID, threadID, title))
}

// ChatDelete 永久移除 Writer 本機對話；不刪除 Agent provider session，也不碰 SteamLoom。
func (a *App) ChatDelete(agentID, projectID, threadID string) (*agent.ChatPage, error) {
	if a.tasks != nil {
		for _, task := range a.tasks.Active(projectID) {
			if task.AgentID == agentID && task.ThreadID == threadID {
				return nil, errors.New("這條對話仍有工作執行中，請先停止工作再刪除")
			}
		}
	}
	return chatPage(agent.DeleteChat(agentID, projectID, threadID))
}

// ChatThreads 彙整專案底下所有 provider 的 thread，供專案層級 task rail 顯示。
func (a *App) ChatThreads(projectID string) ([]agent.ProjectThread, error) {
	if err := a.recoverInterruptedApplies(projectID); err != nil {
		return nil, err
	}
	threads, err := agent.ProjectThreads(projectID)
	if err != nil {
		return nil, err
	}
	active := []agent.Task{}
	if a.tasks != nil {
		active = a.tasks.Active(projectID)
	}
	for i := range threads {
		thread := &threads[i]
		thread.LastTaskState = staleTaskState(thread.LastTaskState, active, thread.AgentID, thread.ID)
		for _, task := range active {
			if task.AgentID != thread.AgentID || task.ThreadID != thread.ID {
				continue
			}
			if task.State == agent.TaskRunning || thread.LastTaskState != agent.TaskRunning {
				thread.LastTaskState = task.State
				thread.ActiveTaskID = task.ID
			}
		}
	}
	return threads, nil
}

func (a *App) recoverInterruptedApplies(projectID string) error {
	a.recoveryMu.Lock()
	defer a.recoveryMu.Unlock()
	if a.recoveredProjects[projectID] {
		return nil
	}
	active := map[string]bool{}
	if a.tasks != nil {
		for _, task := range a.tasks.Active(projectID) {
			active[task.ID] = true
		}
	}
	if err := agent.RecoverInterruptedApplies(projectID, active); err != nil {
		return err
	}
	a.recoveredProjects[projectID] = true
	return nil
}

// ChatProposals 只讀 Writer 本機的待確認成果，不接觸 SteamLoom MCP。
func (a *App) ChatProposals(agentID, projectID, threadID string) ([]agent.Proposal, error) {
	return agent.Proposals(agentID, projectID, threadID)
}

// ConfirmProposalApplied 記錄作者已從 SteamLoom 確認寫入成功；只修正本機狀態，不重送 REST mutation。
func (a *App) ConfirmProposalApplied(agentID, projectID, threadID, proposalID string) (*agent.Proposal, error) {
	proposal, err := agent.ConfirmProposalApplied(agentID, projectID, threadID, proposalID)
	if err != nil {
		return nil, err
	}
	return &proposal, nil
}

// ProposalInvalidOutput 讀回提案無法使用時保存的 Agent 原始回答，讓作者自行檢視或複製。
func (a *App) ProposalInvalidOutput(agentID, projectID, threadID, eventID string) (string, error) {
	return agent.ProposalInvalidOutput(agentID, projectID, threadID, eventID)
}

// ProposalAssetPreview 只在使用者打開 review 時讀取 Writer 管理的本機圖片。
func (a *App) ProposalAssetPreview(agentID, projectID, threadID, proposalID, itemID string) (string, error) {
	return agent.ProposalAssetPreview(agentID, projectID, threadID, proposalID, itemID)
}

// ProposalArtifactPreview 讀取圖像作品或批次媒體提案中的單一 staged artifact。
func (a *App) ProposalArtifactPreview(agentID, projectID, threadID, proposalID, itemID, artifactID string) (string, error) {
	return agent.ProposalArtifactPreview(agentID, projectID, threadID, proposalID, itemID, artifactID)
}

// DecideProposal 保存作者決策；核准後由 Writer 經 REST API 套用，Agent 不會再取得寫入權限。
func (a *App) DecideProposal(agentID, projectID, threadID, proposalID, decision string, selectedItemIDs []string) (*agent.Proposal, error) {
	proposal, err := agent.ProposalByID(agentID, projectID, threadID, proposalID)
	if err != nil {
		return nil, err
	}
	if decision == agent.ProposalDecisionApprove && proposal.Status == agent.ProposalAwaitingConfirmation {
		selected := map[string]bool{}
		for _, id := range selectedItemIDs {
			selected[id] = true
		}
		for _, item := range proposal.Items {
			if len(selected) > 0 && !selected[item.ID] {
				continue
			}
			if item.TargetID == "" || (item.Kind != agent.ProposalKindStory && item.Kind != agent.ProposalKindLore) {
				continue
			}
			document, err := a.api.Document(a.ctx, projectID, api.DocumentKind(item.Kind), item.TargetID)
			if err != nil {
				return nil, err
			}
			if document.LatestVersionID == nil || fmt.Sprint(*document.LatestVersionID) != item.BaseVersionID {
				return nil, fmt.Errorf("%s 的目前版本已變更，請讓 Agent 重新產生提案", item.Title)
			}
		}
	}
	decided, err := agent.DecideProposal(agentID, projectID, threadID, proposalID, decision, selectedItemIDs)
	if err != nil {
		return nil, err
	}
	if decision == agent.ProposalDecisionApprove && decided.Status == agent.ProposalApproved {
		if _, err := a.tasks.Apply(decided); err != nil {
			return nil, err
		}
	}
	return &decided, nil
}

// DecideMediaProposal 先以 Worker schema 驗證作者調整的參數，再沿用一般 proposal apply lifecycle。
func (a *App) DecideMediaProposal(agentID, projectID, threadID, proposalID string, inputs map[string]any) (*agent.Proposal, error) {
	proposal, err := agent.ProposalByID(agentID, projectID, threadID, proposalID)
	if err != nil {
		return nil, err
	}
	if len(proposal.Items) != 1 || proposal.Items[0].ProposalType != agent.ProposalTypeMediaBrief {
		return nil, errors.New("這批提案不是媒體生成需求")
	}
	validated, err := a.workers.ValidateJob(proposal.Items[0].WorkerID, inputs)
	if err != nil {
		return nil, err
	}
	configured, err := agent.ConfigureMediaProposal(agentID, projectID, threadID, proposalID, validated)
	if err != nil {
		return nil, err
	}
	return a.DecideProposal(agentID, projectID, threadID, proposalID, agent.ProposalDecisionApprove, []string{configured.Items[0].ID})
}

func staleTaskState(state string, active []agent.Task, agentID, threadID string) string {
	if state != agent.TaskQueued && state != agent.TaskRunning {
		return state
	}
	for _, task := range active {
		if task.AgentID == agentID && task.ThreadID == threadID {
			return state
		}
	}
	return agent.TaskInterrupted
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

// StartTask 立即回傳 task；實際 CLI 執行由 TaskManager 在背景依 thread 排程。
func (a *App) StartTask(id string, req agent.Request) (*agent.Task, error) {
	workers, err := a.workers.AgentCapabilities()
	if err != nil {
		return nil, err
	}
	req.SetMediaWorkers(workers)
	task, err := a.tasks.Start(id, req)
	if err != nil {
		return nil, err
	}
	return &task, nil
}

// CancelTask 只停止指定 task，不影響同專案或同 provider 的其他 thread。
func (a *App) CancelTask(taskID string) error { return a.tasks.Cancel(taskID) }

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

// ListDocuments 是「全部作品／全部設定」頁的資料；kind 是 "story" 或 "lore"。
func (a *App) ListDocuments(project, kind string) ([]api.ListedDocument, error) {
	return a.api.ListDocuments(a.ctx, project, api.DocumentKind(kind))
}

// ApiProxy 讓前端直接沿用網站的 API 呼叫（axios adapter 轉過來，見 frontend/src/lib/webApi.tsx）：
// path 是 /storyteller 之後的路徑（含 query string），token 仍只在 Go 端。
func (a *App) ApiProxy(method, path, body string) (*api.ProxyResponse, error) {
	return a.api.Proxy(a.ctx, method, path, body)
}
