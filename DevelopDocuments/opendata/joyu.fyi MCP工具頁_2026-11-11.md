# joyu.fyi MCP 工具頁

> 狀態：已實作（branch `feat/joyu-mcp-tools-page`）
> Mockup：`DevelopDocuments/opendata/joyu-mcp-tools-mockup/index.html`

## 目的

讓想用 AI（Claude、ChatGPT、Codex 等）查 joyu 資料的人知道：

- 連線網址。
- 怎麼接上去。
- 有哪些工具、各自吃哪些參數。

## 網址

- 頁面放在 `/mcp-tools`。
- 不能用 `/mcp`：nginx 的 `location = /mcp` 會把所有請求（含瀏覽器開網頁的 GET）轉給後端 `/joyu-mcp`。
- 入口：
  - 頁尾（`JoyuFooter`）加一個「MCP 工具」連結。
  - 主選單不放，對一般訪客不是主要功能。
- 麵包屑：首頁 › MCP 工具。

## 頁面內容

### 1. 連線網址

`https://joyu.fyi/mcp`，附複製按鈕。

### 2. 連線方式

用分頁切換各服務，指令格式沿用 SteamLoom（`pages/storyteller/mcpClientSetup.ts`）。joyu 不用身分驗證，所以每個服務只有一段：

| 服務 | 內容 |
|------|------|
| Claude（網頁／桌面版） | 設定 › 連接器 › 新增自訂連接器，貼上網址 |
| ChatGPT | 開發者模式 › 連接器，貼上網址 |
| Claude Code | `claude mcp add --transport http joyu https://joyu.fyi/mcp` |
| Codex | `codex mcp add joyu --url https://joyu.fyi/mcp` |
| 其他（Cursor 等） | `mcpServers` JSON 範例 |

### 3. 工具列表

分成三組：

- 搜尋：`av_video_search`、`av_actress_search`
- 上稿：`av_actress_submit`、`av_video_submit`
- 查審核結果：`av_actress_submission_status`、`av_video_submission_status`

每張卡片的內容：

- 中文名稱與一句說明，來自前端對照表。
- 工具名稱（`code`）。
- 參數表：名稱、型別、必填、說明。
  - 參數說明直接用 schema 的英文原文，不另外翻譯，避免兩份內容不同步。
  - 參數表預設收合，點開才顯示，避免頁面太長。
  - 參數順序照英文字母排：後端的 schema 是 Go map，輸出 JSON 時就已經排序過了，必填參數會標「必填」。
- PC 兩欄、手機一欄；手機版參數表隱藏「型別」欄。

`ping` 不顯示。

## 資料來源

- 頁面載入時直接呼叫後端 `${api}/joyu-mcp` 的 `tools/list`（JSON-RPC POST，不用 initialize，也不用登入）。
  - 後端加減工具或改參數，頁面自動跟上。
- 中文名稱、說明與分組放在前端對照表 `data/joyuMcpTools.ts`，以工具名稱為 key。
  - 對照表沒有的新工具，放進「其他」組並顯示英文描述，不會漏掉。
- React Query 的 `staleTime` 設長一點（工具清單很少變）。
- 讀取失敗時跳 snack。

## 檔案

```
static_site/src/
  apis/common/mcpTools.ts               // useMcpTools(endpoint)：tools/list，回傳 name／description／inputSchema
  components/common/mcp/McpToolCard.tsx // 工具卡片＋參數表（通用，faryne.dev 的 /mcp 之後也能用）
  components/common/mcp/McpConnectGuide.tsx // 連線網址＋各服務分頁（通用，吃 endpoint 與伺服器名稱）
  data/joyuMcpTools.ts                  // joyu 工具的中文名稱／說明／分組
  pages/joyu/McpTools.tsx               // 頁面：組合上面三塊
  routes/joyuRoutes.tsx                 // 加 /mcp-tools
  components/joyu/JoyuFooter.tsx        // 加連結
```

- 後端不用改；本機透過 `${api}/joyu-mcp` 呼叫（CORS 已允許 `*.localhost`）。
- 為什麼不共用 SteamLoom 的連線元件：那套綁 OAuth、Personal Access Token、Skill 安裝與五語系 i18n。joyu 不用身分驗證，硬套反而更複雜，所以只沿用指令格式。

## 不做

- 線上試打工具（在頁面上直接送 `tools/call`）。
  - 上稿工具會真的建資料，搜尋工具網站本身就有。
  - 有需要再加。

## User story

- 想用 Claude 查女優的人：從頁尾點進來 → 複製網址 → 照 Claude 分頁的步驟加上連接器。
- 開發者：看工具卡片的參數表，知道 `av_video_search` 能用哪些條件。
- 後端新增工具但前端對照表忘了補：頁面在「其他」組顯示英文描述，不會漏。

## 實作紀錄（2026-11-11）

- 檔案照上面「檔案」一節；麵包屑是在 `components/joyu/joyuNavigation.ts` 的 `joyuSections` 加「MCP 工具」，頁尾在 `JoyuFooter` 加連結。
- 工具清單：`useMcpTools()` 打 `VITE_API_BASE` 底下的 `/joyu-mcp`，`staleTime` 1 小時；讀取失敗跳可關閉的 snack。
- ChatGPT 步驟依 2026-11 多份第三方教學整理（設定 › 應用程式與連接器 › 進階設定開開發者模式 → 建立連接器、驗證選「無」→ 新對話的 + 選單選連接器）；各方案能不能用開發者模式說法不一，頁面不寫方案限制。選單改名時改 `components/common/mcp/McpConnectGuide.tsx` 的 `guidesOf`。
- 驗證（本機 joyu.localhost）：
  - 頁尾連結進入，麵包屑「joyu.fyi / MCP 工具」，標題「MCP 工具 | joyu.fyi」。
  - 三組共 6 張卡片，`ping` 不顯示；影片搜尋展開 19 個參數。
  - 手機版無橫向捲動、型別欄隱藏；Claude Code 分頁指令正確。
- 未驗證：「其他」組（目前所有工具都有對照）、複製到剪貼簿（瀏覽器自動化環境不方便驗）。
