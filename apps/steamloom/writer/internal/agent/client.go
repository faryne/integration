// Package agent 偵測本機的 AI CLI，並定義三家的問答送出介面。
// 呼叫端只組 Request、拿 Reply；每家各自把 Request 編成自己的指令。
package agent

import (
	"context"
	"errors"
	"fmt"
	"os"
	"path/filepath"
	"strings"
	"time"
)

// 一輪問答的上限。寫作問答不跑工具，正常遠短於這個時間；逾時就停掉 CLI。
const askTimeout = 10 * time.Minute

// Request 是一輪問答。三家都吃這一包。對話掛在專案上，不掛某一篇文件。
// ThreadID 指出要接到哪一條本機對話；空的表示這則會開新串。
// SessionID 由那條串的紀錄決定，空字串才會讓 CLI 開新 session。
type Request struct {
	ThreadID   string `json:"thread_id"`
	SessionID  string `json:"session_id"`
	ProjectID  string `json:"project_id"`
	Kind       string `json:"kind"`
	DocumentID string `json:"document_id"`
	Title      string `json:"title"`
	Prompt     string `json:"prompt"`
	emit       func(StreamEvent)
	mcpServer  string
	workDir    string
}

// Reply 是這一輪的回答。ThreadID／Title 是存檔之後的結果，前端用來更新串列表。
type Reply struct {
	SessionID string `json:"session_id"`
	Text      string `json:"text"`
	ThreadID  string `json:"thread_id"`
	Title     string `json:"title"`
	proposals []ProposalItem
}

// Installed 是選單上的一項：這台機器找得到的 CLI。
type Installed struct {
	ID          string `json:"id"`
	DisplayName string `json:"display_name"`
	Path        string `json:"path"`
}

// Client 是一家 CLI 的問答送出介面。
type Client interface {
	Ask(ctx context.Context, req Request) (Reply, error)
}

type vendor struct {
	id, display, bin string
	new              func(path string) Client
}

// 順序就是選單順序。沒安裝的在 Detect 時拿掉。
var catalog = []vendor{
	{id: "claude", display: "Claude Code", bin: "claude", new: newClaude},
	{id: "codex", display: "Codex", bin: "codex", new: newCodex},
	{id: "grok", display: "Grok Build", bin: "grok", new: newGrok},
}

// Ask 把一輪問答交給 id 指定的那一家。
func Ask(ctx context.Context, id string, req Request) (Reply, error) {
	if err := req.validate(); err != nil {
		return Reply{}, err
	}
	client, err := open(id)
	if err != nil {
		return Reply{}, err
	}
	if ctx == nil {
		ctx = context.Background()
	}
	// Writer 只讀本機 CLI 設定來限制這輪可見的 tool；MCP 連線、OAuth 與內容讀取都由 Agent CLI 自己處理。
	home, err := os.UserHomeDir()
	if err != nil {
		return Reply{}, err
	}
	if serverName, installed, err := mcpServer(id, home); err != nil {
		return Reply{}, err
	} else if installed {
		req.mcpServer = serverName
	}
	ctx, cancel := context.WithTimeout(ctx, askTimeout)
	defer cancel()
	reply, err := client.Ask(ctx, req)
	if err != nil {
		return Reply{}, err
	}
	reply.Text, reply.proposals, err = parseProposalEnvelope(reply.Text)
	if err != nil {
		return Reply{}, err
	}
	return reply, nil
}

func open(id string) (Client, error) {
	for _, item := range catalog {
		if item.id != id {
			continue
		}
		path, ok := lookup(item.bin)
		if !ok {
			return nil, fmt.Errorf("這台電腦沒有安裝 %s", item.display)
		}
		return item.new(path), nil
	}
	return nil, errors.New("不支援的 AI Agent")
}

func (r Request) validate() error {
	if strings.TrimSpace(r.Prompt) == "" {
		return errors.New("請輸入訊息")
	}
	if r.ProjectID == "" {
		return errors.New("缺少專案資訊，無法送出")
	}
	if !validSession(r.SessionID) {
		return errors.New("對話編號不正確，請重新開一段對話")
	}
	return nil
}

// 只接受 CLI 回傳的 session id，避免被當成額外的指令參數。
func validSession(id string) bool {
	if id == "" {
		return true
	}
	if len(id) > 200 || strings.HasPrefix(id, "-") || strings.ContainsAny(id, " \t\r\n\"'\\/") {
		return false
	}
	return true
}

// 每輪都帶上專案名稱與限制。題目若以 / 開頭，也不會被 CLI 當成斜線指令。
func (r Request) body() string {
	title := strings.TrimSpace(r.Title)
	if title == "" {
		title = "未命名"
	}
	if r.mcpServer != "" {
		return fmt.Sprintf("你是 SteamLoom Writer 裡的寫作助手。作者正在看專案〈%s〉（project_public_id: %s）。你可以使用這輪提供的 SteamLoom 唯讀與內容驗證工具自行讀取作品、設定、記憶與資產；不得建立、更新、刪除、移動、上傳或執行其他具副作用的操作。產生的內容只能放在回答或 Writer proposal 中，尚未寫入 SteamLoom。除了 provider 自己產生、且放在目前工作目錄內的 proposal 圖片，不要修改其他本機檔案，也不要執行指令。%s%s\n\n作者的問題：\n%s", title, r.ProjectID, r.referenceRules(), r.proposalRules(), strings.TrimSpace(r.Prompt))
	}
	return fmt.Sprintf("你是 SteamLoom Writer 裡的寫作助手。作者正在看專案〈%s〉。只用自然語言回答寫作問題，不要修改檔案，也不要執行指令。%s\n\n作者的問題：\n%s", title, r.proposalRules(), strings.TrimSpace(r.Prompt))
}

func (r Request) proposalRules() string {
	return `
成果規則：只有作者明確要求建立、修改或上傳 SteamLoom 內容時，才在一般回覆摘要之後附上一個 Writer proposal；討論、分析、腦力激盪或文筆示範不要附。proposal 只是本機待確認資料，不得呼叫任何寫入工具。格式必須以獨立行 <<<STEAMLOOM_WRITER_PROPOSAL_V1>>> 開始、<<<END_STEAMLOOM_WRITER_PROPOSAL_V1>>> 結束，中間是單一 JSON object：{"items":[...]}。每個 item 只用 kind（story／lore／asset）、operations（陣列，每項有 tool 與 arguments）、target_id、base_version_id、title、summary、content_type、content、base、local_path、file_name、mime_type、alt_text、collection_id。更新既有 story／lore 時必須附 target_id、讀取時取得的 base_version_id，以及包含 title／summary／content_type／content 的 base snapshot；新增時省略。story／lore 的 review 欄位 title、summary、content_type、content 是作者實際確認的唯一完整版本，搜尋取代或段落／章節修改也必須回傳修改後全文。Writer 只把 operations 保存為意圖紀錄，不會執行其中的 tool 或 arguments；使用者核准後由 Writer 自己呼叫 REST API 套用 review 欄位。asset 的 local_path 必須是目前工作目錄內的絕對路徑。結束標記後不要再輸出任何內容。`
}

// Writer 只傳遞原始指示詞，不展開內容；名稱解析與讀取都由 Agent 的 MCP 工具完成。
func (r Request) referenceRules() string {
	if !strings.Contains(r.Prompt, "@story:") && !strings.Contains(r.Prompt, "@lore:") {
		return ""
	}
	return "\n引用規則：@story:[標題] 請先用 storyteller_list_stories 在目前專案依完整標題定位，再用 storyteller_get_story 讀取；@lore:[標題] 同理使用 storyteller_list_lores 與 storyteller_get_lore。若同名、找不到或無法確定目標，先在回答中請作者確認，不要自行猜測。Writer 沒有附上引用內容。"
}

// 問答的工作目錄跟作品倉庫分開，CLI 才不會把 Writer 的專案當成程式專案去改。
func (r Request) dir() (string, error) {
	if r.workDir != "" {
		return r.workDir, nil
	}
	base, err := os.UserConfigDir()
	if err != nil {
		return "", err
	}
	dir := filepath.Join(base, "SteamLoom Writer", "agent-sessions", segment(r.ProjectID))
	if err := os.MkdirAll(dir, 0o755); err != nil {
		return "", err
	}
	return dir, nil
}

func segment(value string) string {
	var b strings.Builder
	for _, r := range value {
		switch {
		case r <= 0x1f || strings.ContainsRune(`/\:*?"<>|`, r):
			b.WriteByte('_')
		default:
			b.WriteRune(r)
		}
	}
	s := b.String()
	if s == "" || s == "." || s == ".." {
		return "_"
	}
	if len(s) > 80 {
		return s[:80]
	}
	return s
}
