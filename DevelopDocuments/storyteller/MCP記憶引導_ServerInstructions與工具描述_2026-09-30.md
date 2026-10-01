# MCP 記憶引導：Server Instructions 與工具描述

- 狀態：**已實作（branch `feature/mcp-memory-guidance`），待部署驗證**；「三、不在這次範圍」尚未處理
- 相關：`AI助理記憶功能_2026-09-18.md`

## 問題

外部 AI（Claude Code、ChatGPT、Cursor 等）第一次透過 MCP 串接 Storyteller 時，記憶功能實際上不會被用到：

1. **記憶是 pull 模式**：站內梭梭由 `agent_pipeline.go` 自動把記憶注入 `<Memories>`，但外部 AI 要自己想到去呼叫 `storyteller_list_memories`。沒有東西提醒，它讀完 `get_story` 就直接開寫。
2. **`initialize` 沒回 `instructions`**：`service/mcp/server.go` 的 initialize 只回 `protocolVersion`／`capabilities`／`serverInfo`。MCP 的 `instructions` 是協定層、跨 client 都會吃的引導管道，目前沒用上。
3. **工具描述只講「怎麼用」，沒講「何時用」**，而且寫「Suosuo's memories」：外部 AI 會以為是另一個助理的私人筆記、跟自己無關。
4. **部分 client 延後載入 MCP 工具**（例如 Claude Code 的 deferred tools，一開始只看得到工具名稱）。描述裡沒有觸發情境，搜尋工具時也不容易命中。
5. **MCP upsert 會直接 `confirmed`**，跳過 Web 端的人工確認；外部 AI 如果主動寫入，等於繞過原本「使用者確認才生效」的設計。

目標：**不需要使用者另外裝 skill 或寫 CLAUDE.md**，任何 MCP client 第一次接上就知道該先讀記憶，並且在寫入前會先徵求作者同意。

## 一、Server Instructions

### 實作

`Server` 加一個 `instructions` 欄位，initialize 時有值才帶出去。`protocolVersion` 2024-11-05 的 `InitializeResult` 本來就有 `instructions?: string`，不需要升版。

```go
type Server struct {
	name         string
	version      string
	instructions string // initialize 回傳給 client 的使用引導；空字串不輸出
	tools        map[string]Tool
}

// initialize
result := map[string]interface{}{ /* protocolVersion, capabilities, serverInfo */ }
if s.instructions != "" {
	result["instructions"] = s.instructions
}
```

`NewStorytellerServer` 設定 `s.instructions = storytellerService.MCPServerInstructions`。文字常數放在 `service/storyteller`，跟工具描述在同一個 package 維護；預設 `/mcp`（av/nekomaid）不受影響。

### 文字（英文，與既有工具描述一致）

原則：
- 保持精簡。部分 client 會截斷過長的 instructions，重點放在前面。
- 衝突優先序沿用梭梭的 `promptRuleMemories`，站內站外行為一致。
- 只寫「工具描述無法表達的跨工具流程」，單一工具的參數細節留在描述裡。

```text
Storyteller is the author's writing workspace: projects hold stories, lore (worldbuilding) and image assets. Every call acts on the authenticated author's own data.

READ MEMORIES BEFORE YOU WRITE
- The author keeps confirmed, long-lived writing memories per project (shown in the web UI as 「梭梭的記憶」, shared by the built-in assistant and every MCP client). They hold style preferences, standing instructions, settled plot/setting decisions and background that are not in the story text.
- Before drafting, continuing, rewriting or reviewing a story or lore entry, call storyteller_list_memories with project_public_id plus that story_public_id or lore_public_id. Once per target per conversation; call again when the target changes. Use storyteller_search_memories for a specific character, term or scene.
- Don't know project_public_id? Call storyteller_list_projects first.
- Apply relevant memories without announcing them. Precedence: the author's current request > facts in the current story/lore text > story/lore-scoped memories > project-scoped memories. Pinned and higher-priority memories win ties. If a memory conflicts with the current request, follow the request and briefly ask whether to update the memory.

PROPOSE MEMORIES, NEVER WRITE SILENTLY
- When the author says something meant to last ("from now on…", "never…", a correction with a before/after example, a settled plot decision), offer to save it. Show the exact content, scope, kind and tags, and call storyteller_upsert_memory only after the author agrees in the conversation — MCP writes take effect immediately, with no review step.
- Search first; if a memory already covers it, update that one (memory_public_id) instead of adding a near-duplicate.
- Never store secrets, credentials, personal data, one-off task state, or your own guesses.

EDITING
- Keep version_id from storyteller_get_story / storyteller_get_lore and pass it back as base_version_id when saving, so edits made in the web editor meanwhile are detected instead of overwritten.
- For long stories, prefer chapter tools (storyteller_list_story_chapters, storyteller_get_story_chapter, storyteller_replace_story_chapter) over rewriting the whole story.
```

> EDITING 段跟記憶無關，但同樣屬於「外部 AI 第一次用最容易踩雷」的流程，順便放進來。不想擴大範圍的話可以先拿掉。

## 二、工具描述

`storyteller_list_memories`／`storyteller_search_memories` **跟梭梭共用**（`StorytellerToolRegistry` 同時給 MCP 與 agent runner）。梭梭已經自動注入記憶，所以描述要用條件句（「如果 context 裡還沒有記憶…」），同一段文字兩邊都適用，不需要拆成兩份描述。

### `storyteller_list_memories`

```go
Description: "List the author's confirmed writing memories for a project: style preferences, standing instructions, " +
	"settled plot/setting decisions and background that the story text itself doesn't record " +
	"(shown in the web UI as 梭梭的記憶, shared by the built-in assistant and all MCP clients). " +
	"Call this before drafting, continuing, rewriting or reviewing a story or lore entry, unless these memories are already in your context. " +
	"Always returns project-scoped memories; pass story_public_id or lore_public_id (never both) to add memories for that target. " +
	"Narrower scope wins on conflict (story/lore over project); the author's current request overrides any memory.",
```

### `storyteller_search_memories`

```go
Description: "Search the author's confirmed writing memories by keyword or tag (matches name, content and tags) " +
	"within a project and optional story/lore scope. Use it to check rules about a specific character, term, relationship or scene, " +
	"and before storyteller_upsert_memory to find an existing memory to update instead of creating a duplicate.",
```

### `storyteller_upsert_memory`（MCP-only）

重點是把「先徵求同意」寫進描述本身：這支只有外部 AI 看得到，而且 instructions 可能被 client 截斷或忽略。

```go
Description: "Create or partially update one of the author's writing memories. MCP writes are active immediately with no review step, " +
	"so only call this after the author has explicitly agreed in the conversation to the exact content and scope. " +
	"Search first and pass memory_public_id to update an existing memory instead of duplicating it; only supplied fields change, " +
	"and the ID must already exist in the requested context. Omit memory_public_id to create; scope_type, kind and content are then required. " +
	"project_public_id is always required for authorization. " +
	"kind: preference = style/taste, instruction = standing rule, decision = settled plot/setting choice, context = background fact.",
```

`content` 參數描述補一句寫法要求，讓其他 AI 讀了也能直接套用：

```go
"content": stringSchema("Required on create; optional on update. One atomic, self-contained fact, at most 2000 characters, " +
	"written so another AI with no chat history can apply it (include a short before/after example for style corrections)."),
```

### `storyteller_get_story`／`storyteller_get_lore`：各補一句

這兩支是外部 AI 最先呼叫的工具，在描述尾端補一句導流。遇到 instructions 被截斷，或 client 根本不顯示 instructions 時，這句就是備援。同樣用條件句，梭梭讀到也不會誤導。

```go
" Before writing based on this content, load the author's memories via storyteller_list_memories with the same story_public_id if they aren't already in your context."
```

（lore 版把 `story_public_id` 換成 `lore_public_id`。）

## 三、不在這次範圍（下一步）

- ~~**Push 完整記憶**~~：**不建議**。`get_story`／`get_lore` 回傳直接附記憶內容，到達率最高，但會把讀取資料的 API 跟寫作引導混在一起：只是摘要、查字數時也被塞記憶；同一 session 讀多篇時 project 記憶一再重複；梭梭那邊也會重複注入。
- ~~**`get_writing_context`**~~：**不做**。原構想是一次回傳 story、相關 lore、記憶，但系統沒有 story ↔ lore 的關聯資料（梭梭的 lore 也是使用者用 @ 手動指定），server 無從判斷哪些 lore 相關：全丟會 token 爆量，只丟標題又跟 `get_project` 重複。要做的前提是先有 story ↔ lore 關聯（作者勾選或內文比對），屬於另一個功能。
- **Push 的替代方案**：`get_story`／`get_lore` 回傳只附記憶摘要（project／target 數量加上名稱，沒有記憶就省略整個欄位），內容讓模型按需呼叫 `list_memories` 取得，思路與梭梭的 `ReferencesByTool` 一致。
- **MCP `prompts`**：提供「接寫章節」「潤飾對白」範本，把讀記憶的步驟寫進範本；支援的 client 會列成 slash command。

## 驗證方式

1. `server_test.go` 補 initialize 回傳含 `instructions` 的斷言；預設 `/mcp` server 不含。
2. 用全新的 Claude Code session（沒有任何 CLAUDE.md、skill）接 storyteller MCP，下「幫我接寫 XX 故事下一段」，確認第一輪就會呼叫 `list_memories`。
3. 同一 session 糾正一句文筆，確認 AI 是**提議**存成記憶，而不是直接 upsert。
4. 梭梭在站內跑一輪，確認描述改動沒讓它多呼叫 `list_memories`（context 裡已有 `<Memories>`）。
