# AI 助理重構：單一非同步入口與 XML Request

- 狀態：**已實作於 `refactor/storyteller-agent-prompts`（11 個重構 commit，基底 `main` @ `82f4ad4`）**，Go 測試、`tsc`、vitest 皆通過（eslint 有 9 個既有錯誤，與本次無關）；**尚未合併、尚未在 staging／prod 實際跑過，DB migration 也尚未套用到任何環境**
- 前置討論：本文彙整重構過程中的判斷與取捨，未另存逐字記錄

## 背景與目的

重構前，AI 助理的送出流程與 prompt 有幾個結構性問題：

| 問題 | 現況（重構前） |
|---|---|
| 三條重複流程 | 一般對話（story）、一般對話（lore）、skill（`/rewrite` 等）各自一份「解析 project／target／agent／key／model／provider → 落地 in_progress chat → goroutine 跑 → 補 assistant 訊息」，再乘上 resend，約 6 份拷貝 |
| 同步殘骸 | `runStoryAgenticQuery`、`resendStoryAgenticQuery` 等同步版只剩測試在用；lore 那兩個連測試都沒人呼叫，是純死碼（合計約 420 行） |
| 兩套 system prompt | `agenticQuerySystemPrompt`（`agentic_query.go`）與 `buildAgentRunPrompts`（`storyteller.go`）各寫一份；`@` 參照語法、project scope、persona 附加、動態尾巴措辭已開始分岔（例如 persona 前綴一邊是 `Agent-specific instructions:`、一邊是 `Agent default configuration:`） |
| 手工 fence 到處都是 | `<<<STORY_SELECTED_CONTENT`、`<<<REPLY_REFERENCE_CONTENT`、`STORYTELLER_HISTORY_ASSISTANT_MESSAGE_%d`… 各自為政，難以分析 |
| skill 的 `full_content` 名不符實 | 前端把「@ 參照＋回覆對象」組成 fence 文字塞進 `full_content`，後端再用行前綴（`Reference story:`／`Token: @`）解析回來；而且**有選取文字時，這些內容整段被丟掉** |
| 對外入口太多 | 送出 3 種（`/run`、`/agentic-query`、resend）× story／lore，加輪詢共 8 個 handler、8 條路由 |

**目標**：
1. 只有**一套機制**：所有動作都是非同步，差別只在 system prompt 與 user prompt 內容。
2. user 端上下文改成 **XML 結構**（`<Request>`），更組織化、方便分析，且**同一份存進 `story_chat_messages.metadata`**。
3. system prompt 抽出共用，只維護一份。

## 最終架構

### 單一非同步 pipeline（`service/storyteller/agent_pipeline.go`）

```
Service.SubmitAgent / ResubmitAgent            ← 唯一對外入口（controller 只呼叫這兩個）
        │
        ▼
submitAgent ──┬─ skill == ""  → submitAgenticQuery   （一般對話）
              └─ skill != ""  → submitAgentSkill      （/rewrite 等）
        │  兩者都呼叫
        ▼
submitAgentRun（唯一的骨架）
  1. resolveAgentRunPlan  解析 project → target(story|lore) → agent → key → model → provider → apiKey
  2. work.Track           送出當下就註冊背景工作；server 正在 drain 時回 ErrAgenticQueryServerDraining
  3. Begin(plan)          ← 差異點 1：怎麼落地這則使用者訊息（渲染 XML、建 in_progress chat）
  4. go Run(ctx)          ← 差異點 2：背景怎麼呼叫 provider、把結果補進 chat
  5. 回 ack               chat 已 in_progress，結果靠輪詢取得
```

- **story 與 lore 只差 `agentRunTarget.Kind`**（`newAgentChat`、`recentAgenticHistory`、`claimChatForResend` 依 Kind 分派），不再各複製一份。
- **不再有同步版本**。理由沿用既有設計：不讓使用者的請求被 provider 的等待時間、或 HTTP client 固定逾時卡住（見「已知 Bug 記錄」：60 秒逾時曾讓合法但較慢的生成被砍掉）。
- 背景失敗時 chat 退回 `pending`，可重送；撞到步數上限（`ErrAgentLoopMaxStepsExceeded`）的錯誤只寫 log、已花掉的 usage 仍會落地。

### 統一入口與路由

| 舊 | 新 |
|---|---|
| `POST .../stories/:story/agents/:agent/run`（skill）<br>`POST .../stories/:story/agents/:agent/agentic-query`（一般對話）<br>（lore 各一份） | `POST /storyteller/agent-chats`（送出，一般對話與 skill 共用） |
| `POST .../agents/:agent/agentic-query/:chat/resend`（story／lore 各一份） | `POST /storyteller/agent-chats/:chat/resend` |
| `GET .../stories/:story/agentic-query/:chat`（story／lore 各一份） | `GET /storyteller/agent-chats/:chat` |

**只有一組路由，目標由請求體指定**：送出時帶 `project_public_id`，以及 `story_public_id`／`lore_public_id` 二選一（`agentTargetFromRequest` 驗證，缺 project 或 story／lore 不是恰好一個都回 400）。之後要支援專案層或全站層的 AI 助理，只需放寬這個函式（例如不帶 story／lore＝專案層），不用再新增路由。

- **重送與輪詢只靠 chat id**：chat 掛在哪個專案／故事／設定集由 chat 反查（`repo.AgentChatTarget`），且只有建立者本人（`chats.user_id`）查得到。
- **路由裡不再有 `:agent`**：沒有「目前選中的 Agent」這個概念（見下方）。`/agents/:agent` 只剩管理使用者自建 skill 的 CRUD。
- 專案層／全站層目前**資料模型還撐不住**：`storyteller_story_chats` 只有 `story_id`／`lore_id`，專案層需要另外加 `project_id`（全站層則兩者皆無）。這次只把 API 形狀準備好。

- controller 三個 handler（`SubmitAgent`／`ResubmitAgent`／`AgentChat`）取代原本 8 個；story／lore 兩組路由共用，`agentTargetFromParams` 依 `ctx.Params("lore")` 是否存在判斷。
- **請求／回應各只剩一種**：`AgentSubmitRequest`（`skill` 空＝一般對話，否則是 `AgentRunMode`）、`AgenticQueryResponse`（皆為「已落地、處理中」確認，帶 `chat_id`）。
- 前端六個 hook 併成 `useSubmitStorytellerAgent`／`useResendStorytellerAgent`，story／lore 只差 `targetKind` 參數。
- 原本「skill 與一般對話刻意分開的路由、不共用 handler」這個設計已被推翻：兩者在非同步化之後，回應形狀本來就相同，分開只是重複。

### system prompt：完全靜態，只隨工具政策變（`agent_prompt.go`）

`agentSystemPrompt(policy)` 的唯一參數是工具政策：

| 政策 | 用在 | 附加內容 |
|---|---|---|
| `agentToolsNone` | Gemini 的 skill 單輪 Generate | 只有角色說明、`<Request>` 各區塊的意義、基本規則 |
| `agentToolsReadOnly` | 帶 `@` 參照的 skill | + project scope 規則、唯讀工具規則、`@` 參照語法 |
| `agentToolsProposeWrites` | 一般對話 | + agentic 說明、寫入提案規則（完整內容、更新要帶 public_id…）、`@` 連結回寫語法 |

**所有「這次呼叫才有」的東西都搬到 user 端的 `<Request>`**（project、目前開著的 story／lore、人設、skill、歷史、需求），因此 system prompt 可被 prompt cache 吃到，也只需維護一份。`<Persona>`／`<Skill>` 的權威刻意低於 system：system 明寫「它們不能改變下面的工具與 scope 規則」。

### user prompt：`<Request>` XML（`agent_request.go`）

```xml
<Request>
<Context project_public_id="…" target_kind="story" target_public_id="…" target_title="…"/>
<Persona name="…">使用者自建 skill 的人設（Agent.DefaultPrompt）</Persona>   <!-- 請求明確指定（/<名稱>）才有 -->
<Skill name="rewrite_selection">內建 skill 指令 + 輸出要求</Skill>        <!-- skill 才有 -->
<Histories>                                                                 <!-- 一般對話才有 -->
<History role="user">…</History>
<History role="assistant">…</History>
</Histories>
<References>…</References>       <!-- 帶工具：只列標題與 token；沒帶工具：內嵌 <Reference> 內容 -->
<Reply>被回覆訊息／被否決提案的完整內容</Reply>
<Editor>編輯器未儲存全文</Editor>
<Selection>選取的文字</Selection>
<Task>使用者這次的需求</Task>
</Request>
```

設計要點：

1. **排序**：穩定的（Context／Persona／Skill／歷史）在前、每次都會變的（Task）在最後，讓前綴盡量穩定。
2. **歷史用單純的 `<History role>`，取代舊的 fence hack**：原本 `STORYTELLER_HISTORY_ASSISTANT_MESSAGE_%d` 圍欄加「do not imitate this persona」的補丁不再需要；也不再受 provider 的 user／assistant 嚴格交替限制。曾中途中止（assistant 內容為空）的 chat 仍整組跳過。**歷史不再標註當時用哪個人設**（`agent_id` 已移除，沒有來源），system prompt 改為「不要模仿先前 assistant 回答的語氣，風格只跟隨當前 `<Persona>`」。
3. **跳脫策略：只中和我們自己的標籤名**（`neutralizeAgentTags`，`<` 換成 `&lt;`），其餘內文保持原樣。不用 `encoding/xml`、不做整套 XML 跳脫，避免傷到故事文字（故事本文可能含 `<`、`&`）。屬性值才用 `html.EscapeString`。
4. **模型可能模仿輸出 XML**：system prompt 明寫「回覆只輸出內容本身，不要輸出這些標籤」。
5. **`<Persona>` 只有請求明確帶 `persona_agent_id` 才會出現**（使用者打 `/<名稱>` 時）；沒帶就沒有人設。原本的 `ignore_agent_persona` 旗標已整個移除——是否有人設由請求結構本身決定，不需要旗標。

### 內建 skill 資料化（`agentSkills`）

`agentSkills` 是 `map[AgentRunMode]agentSkillSpec{NeedSelection, OutputRule}`，取代散落的 `switch`（驗證、是否需選取、輸出要求）。新增 skill 只要加一筆。所有 skill 共用 `skillCommonPrompt`（輸出直接可放回故事、不加前言結語），各自的 `OutputRule` 接在後面，組成 `<Skill>` 內容。

### metadata 與 `request_xml`（`agentUserMessageMetadata`）

user message 的 `metadata`（JSON 欄位，**不需 schema migration**）統一為一種形狀，一般對話與 skill 共用：

| 欄位 | 說明 |
|---|---|
| `mode` | `agentic_query` 或 skill 名稱。**保留原語意**：`RecentStoryAgenticMessages` 依 assistant 訊息的 `mode` 篩歷史、前端依 `mode` 顯示 `/指令` 標籤 |
| `reply_reference` | 短參照（message／proposal），不存回覆全文 |
| `selected_content`／`selected_content_length`／`full_content_length` | skill 用；`selected_content` 必須跟訊息 content 裡嵌的 blockquote 一致（前端靠它剝除重複前綴） |
| `use_tools` | skill 這次有沒有帶唯讀工具，重放時才知道要不要開 loop |
| **`request_xml`** | **實際送給 provider 的完整 `<Request>` 快照**，供分析／除錯 |

- **寫入時機**：在 `CreateInProgressChatWithUserMessage` 落地 in_progress chat 的當下就寫入，所以即使 provider 呼叫失敗、卡在 pending，事後仍能看到當時送了什麼。
- **歷史不讀舊的 `request_xml`**：下一輪的 `<Histories>` 一律從各列的 `content` 原始欄位重新渲染，否則 XML 會一層包一層。`request_xml` 只是那一輪的快照。
- **list API 濾掉 `request_xml`**：`StoryChatMessages`／`LoreChatMessages`／chat 詳情輸出前呼叫 `stripRequestXML`，因為它含歷史與編輯器全文，整包丟進列表 API 會拖慢載入。前端拿不到這個欄位；要分析只能查 DB。

### 重送（resend）

一般對話與 skill 走同一條路（`resubmitAgenticQuery`）：**重放當初存的 `metadata.request_xml`**，由 `metadata.mode` 判斷工具政策（skill → 唯讀 loop；一般對話 → 可提案寫入）。

- **不重新渲染**：沒有「目前選中的 Agent」可以拿來重建人設，而且使用者當初送出的就是這份內容，重放才能前後一致。也因此不再需要 `UpdateChatMessageMetadata`、`metadataWithRequestXML`、從 metadata 反查回覆內容等一整串補丁（已刪除）。
- 請求體只讀 `provider_apikey_id`／`model_name`（重送時可以換 key／model），其餘忽略。
- 沒有 `request_xml` 的舊訊息無法重送，回 `errAgentResendUnavailable`，請使用者重新送出。

### skill 請求改傳結構化欄位

`AgentSubmitRequest`（skill 用到的部分）：

| 欄位 | 說明 |
|---|---|
| `full_content` | **只放編輯器全文**（沒選取文字時才進 `<Editor>`） |
| `selected_content` | 選取的文字，優先於全文 |
| `references[]` | `{kind, title, token, content}`，取代前端把參照組成 fence 文字塞進 `full_content` |
| `reply_content` | 被回覆訊息的完整內容（純文字，不再帶 fence） |

`<References>` 的兩種渲染：**帶工具**時只列 `- Reference story: 標題 / Token: @story:[標題]`，讓模型按需用唯讀工具查；**沒帶工具**（例如 Gemini 單輪 Generate）時內嵌 `<Reference kind title token>內容</Reference>`。是否開 tool loop：`references` 非空或需求裡有 `@thisStory|@thisLore|@story:|@lore:`，且 provider 不是 Gemini。

字數上限維持不變：`references` 內容＋`reply_content`＋`full_content` 合計算進原本 `full_content` 的 60000 字上限（跟過去它們全塞在 `full_content` 裡的語意一致）。被否決提案的參照內容也去掉 `<<<FENCE`，前後端格式一致（`Rejected proposal: <tool>\n{json}`）。

## 討論過程中的取捨

| 議題 | 選擇 | 理由／被否決的選項 |
|---|---|---|
| 歷史用 XML 還是原生多輪 messages | XML | 原生多輪能保留 role 語意與 prompt cache 前綴，但 XML 能擺脫 user／assistant 嚴格交替限制、整段可被完整記錄。代價：失去原生 turn 結構（可接受）。原本設想用 `persona` 屬性標註歷史，後來 `agent_id` 移除而作罷 |
| Persona／Skill 放 system 還是 user | user（`<Request>`） | 讓 system 完全靜態可 cache；權威較低反而是好事，system 明寫不得覆寫工具與 scope 規則 |
| 跳脫 | 只中和自己的標籤名 | 整套 XML 跳脫會傷故事文字；`encoding/xml` 一樣會跳脫。用 builder＋小函式即可 |
| DB 存什麼 | 原始欄位仍在；**另外**存 `request_xml` 快照 | 一開始我的判斷是「XML 只是送出時渲染，不用存」，你更正為必須存進 metadata 供分析。歷史仍從原始欄位渲染，避免巢狀 |
| 快照要不要瘦身 | 照實存完整字串 | 你要的是分析用途。若日後嫌肥，可改成 `<History id="…"/>` 只存參照（**尚未做**） |
| skill 帶不帶歷史 | 不帶 | `repository` 早就刻意排除 skill 訊息（兩種口吻混在一起會互相污染）；單輪改寫不該被之前的對話口吻影響 |
| `ignore_agent_persona` 要不要留 | **移除** | request 已經結構化，人設有沒有由請求是否明確帶 `persona_agent_id` 決定，不需要另一個旗標；旗標還連帶催生了 `messageAgentID`、從 metadata 反推旗標等補丁 |
| `story_chats`／`story_chat_messages` 的 `agent_id` 要不要留 | **移除** | 實際送出的內容（含 `<Persona>`）已完整存在 `request_xml`，兩張表不需要再留 Agent 關聯。代價：訊息泡泡不再顯示 Agent 名稱、歷史無法標註人設、刪除 Agent 不再連帶刪對話（見下） |
| 「目前選中的 Agent」要不要留 | **不留** | 我先前一直把 `:agent` 當成「選了這個 Agent，這段對話就得用它」，因而先做出「人設一律套用 `:agent`」的錯誤版本（一般打字與 skill 會被悄悄套上人設）。實際上 chip 只是在輸入框插入 `/<名稱>` 的捷徑，人設、key、model 都是每次請求明確帶入 |
| 對外 endpoint 併不併 | **併** | 我第一版規劃寫「後端先統一、對外 endpoint 暫時不動」，你指出這與「只留 Submit 作為統一入口」的目標矛盾。這是我把範圍切小的取捨，不是技術限制，後來補做 |
| 舊路由要不要保留相容 | 不保留 | 雛形階段、前後端同 repo，直接換掉 |
| 測試怎麼處理 | 測試沿用舊呼叫形狀的 helper，底下走同一條非同步 pipeline | 同步版刪除後，測試不能再呼叫它；helper 送出後等 tracker 跑完，再從 repo 落地結果還原輸出。刻意不為此新增測試框架 |

## 沒有「目前選中的 Agent」，以及 `agent_id` 移除

輸入框上的 chip 只是**插入 `/<名稱>` 指令的捷徑**。請求明確帶了什麼，後端就用什麼：

| 請求欄位 | 意義 | 沒帶時 |
|---|---|---|
| `skill` | 內建 skill（`/rewrite` 等）→ `<Skill>` | 一般對話 |
| `persona_agent_id` | 使用者自建的 skill（`storyteller_agents` 的一筆，人設在 `DefaultPrompt`）→ `<Persona>` | 沒有人設 |
| `provider_apikey_id`、`model_name` | 這次用哪把 key、哪個 model | **必填**，缺了回 `provider_apikey_id is required`／`model_name is required` |

兩個 skill 概念各自獨立，對應 `<Skill>` 與 `<Persona>` 兩個標籤。

**`Agent` 現在只是使用者自建的 skill：名稱（`/<名稱>` 指令）加人設（`default_prompt`）。** 舊有的 `provider`／`model_name`／`provider_apikey_id`／`agent_model_id` 四個欄位在執行期已不再被讀取，已刪除（migration `20260920110000-drop_provider_model_key_from_storyteller_agents.sql`；版本快照表 `storyteller_agent_prompt_versions` 的 `provider`／`model_name` 一併移除）。`AgentRequest` 只剩 `name`／`default_prompt`，`validateAgent` 只驗名稱；`validateAgentProviderAPIKey`、`agentModelID`、`repo.AgentProviderModel` 隨之刪除。`storyteller_agent_models`（各 provider 的固定模型清單與價格）與 `agents/provider-models` 端點仍保留，面板的 model 選單與計價還在用。

`agent_id` 從對話資料中移除：

| 項目 | 變更 |
|---|---|
| `storyteller_story_chats.agent_id` | 移除（原為 NOT NULL，FK `ON DELETE CASCADE`） |
| `storyteller_story_chat_messages.agent_id` | 移除（原為 NULL，FK `ON DELETE SET NULL`） |
| 列表 API 輸出 | 移除 `agent_id`、`agent_name`；三個列表查詢不再 `LEFT JOIN storyteller_agents` |
| repository | 刪除 `AgentsByIDs`（只剩歷史人設標註在用） |
| 送出回應 `AgenticQueryResponse` | 移除 `agent_id` |
| 前端 | 移除訊息泡泡上的 Agent 名稱 badge，只保留 skill mode badge |

migration：`migration/20260920100000-drop_agent_id_from_storyteller_story_chats_and_messages.sql`（比照 `20260828100000` 對 usage logs 的做法）。**這是不可逆的資料刪除**：欄位內既有的 agent_id 值會隨欄位一起消失，Down 只還原可為 NULL 的欄位結構、不重建外鍵。連帶影響：原本刪除 Agent（硬刪除時）會經由 `chats.agent_id` 的 CASCADE 連帶刪掉它的對話紀錄，欄位移除後這個連動消失，Agent 與對話紀錄互不影響。

**尚未套用到任何環境**；套用前請先確認是哪個環境（本機／staging／prod）並備份。

## 行為變更清單（review 重點）

1. **skill 現在可以重送**（過去 resend 會把 skill chat 誤當一般對話）。
2. **skill 的參照與回覆內容一律送出**（過去有選取文字時整段被丟掉）。
3. **背景錯誤不再回傳給呼叫端**，只寫 log。舊測試裡「撞到 max steps 拿到 error」改成斷言落地結果（usage 仍會記）。
4. **歷史不再是原生多輪 messages**，整組放進單一 `<Request>`。
5. **system prompt 用語統一**，`Authorized project_public_id` 等動態資訊移進 `<Context>`。
6. **人設語意不變但改用明確欄位表達**：一般打字與 skill 沒有人設，`/<名稱>` 才有，跟過去行為一致；只是不再靠 `ignore_agent_persona` 旗標，而是請求有沒有 `persona_agent_id`。
7. **key／model 必填**：不再退回 Agent 記錄上的預設值。
7. **API 路徑與請求／回應形狀改變**（見上表），前端已同步。

## 檔案地圖

| 檔案 | 職責 |
|---|---|
| `service/storyteller/agent_pipeline.go` | `submitAgentRun` 骨架、`SubmitAgent`／`ResubmitAgent` 入口、一般對話／重送／skill 的 `Begin`＋`Run` |
| `service/storyteller/agent_prompt.go` | 靜態 `agentSystemPrompt`、`agentSkills` registry、`skillCommonPrompt` |
| `service/storyteller/agent_request.go` | `agentRequest`＋`XML()`、`buildAgenticRequest`／`buildSkillRequest`、`agentUserMessageMetadata`、歷史轉換 |
| `controller/storyteller/storyteller.go` | 三個 handler |
| `route/storyteller.go` | 路由（story／lore 各三條） |
| `migration/20260920100000-…sql` | 移除兩張對話表的 `agent_id` |
| `migration/20260920110000-…sql` | 移除 `storyteller_agents`（與版本快照表）的 provider／model／key 欄位 |
| `repository/storyteller/storyteller.go` | `stripRequestXML` |
| `static_site/src/apis/storyteller/agent.ts` | `useSubmitStorytellerAgent`／`useResendStorytellerAgent` |
| `static_site/src/pages/storyteller/StorytellerAgenticPanel.tsx` | Panel 改用統一 hook 與結構化欄位 |

`agentic_query.go` 從 1508 行降到 519 行；`storyteller.go` 從 3820 行降到 3503 行（仍遠超 500 行，屬既有債，未在這次處理）；新增的 `agent_pipeline.go` 為 494 行，已接近 500 行門檻。

## Commit 對照

| Commit | 內容 |
|---|---|
| `5c14c0a` | 收斂為單一非同步 pipeline，刪同步死碼 |
| `6ce0a02` | 共用 system prompt 與 skill registry |
| `c3acb40` | `<Request>` XML、`metadata.request_xml`、重送統一、list API 濾 `request_xml` |
| `c0f152c` | skill 請求改傳結構化 `references`／`reply_content` |
| `bf23f29` | 送出／重送／輪詢統一為單一入口（路由、handler、前端 hook） |
| `6dcf26c` | 清除統一入口後遺留的死碼（`complete*` 只回傳 error、`AgentRunResponse`→`AgentRunResult`、前端無用型別） |
| `48dddad` | 移除 `ignore_agent_persona`（此 commit 讓人設一律取自 `:agent`，是錯誤的中間版本，已由 `fb40ba2` 修正） |
| `e13622e` | 移除兩張對話表的 `agent_id`（含 migration、列表查詢、前端 badge） |
| `fb40ba2` | 移除 `:agent` 路由參數：人設／key／model 由請求明確帶入，重送一律重放 `request_xml`，前端刪除 `activeAgentId`／`selectedAgent` |
| `a46e479` | `agent-chats` 統一為單一路由，目標（project／story／lore）由請求體指定 |
| `48ce9b6` | 移除 Agent 上的 provider／model_name／provider_apikey_id／agent_model_id（含 migration） |

## 已知限制與待辦

- **儲存膨脹**：每則 user message 都存最近 5 輪歷史加回覆全文，儲存量隨輪次線性成長。若嫌肥，改存參照（見上）。
- **尚未實際驗證**：只有單元測試與型別檢查；沒有在 staging／prod 跑過整條路徑，也沒有實測 prompt cache 命中率、以及換成 XML 後各 provider（Claude／Grok／Gemini／OpenRouter／self-hosted）的輸出品質是否有差異。
- **前端 `full_content` 目前送空字串**：Panel 原本就沒送編輯器全文（過去 `full_content` 只裝參照與回覆文字），`/continue` 的「目前章節」上下文是否應改送編輯器全文，是既有行為，這次沒動。
- **沒有 `request_xml` 的舊訊息不能重送**（一般對話與 skill 皆然；重構前建立、目前卡在 pending 的一般對話 chat 也會遇到，需使用者重新送出）。
- **歷史無法標註人設**：`<Histories>` 只有 role，模型分不出先前回答是哪個人設寫的，只能靠 system prompt 要求它不模仿。
- **DB migration 未套用**，且不可逆（見上）。
- **`agentRunShouldUseLoop` 對 Gemini 一律不開 loop**，沿用舊行為。
- **lore 版本沒有獨立測試**：測試 helper 都以 story 為目標，lore 走同一條程式碼路徑（只差 `Kind` 分派），但沒有專屬案例。
- **`storyteller.go` 仍是 3503 行大檔**，依「單檔超過 500 行就要審視」慣例值得日後拆分。

- **部署順序：先跑兩支 migration、再部署新程式碼**。migration 跑完到新版上線之間，舊版程式碼會因欄位不存在而失敗（已接受，不做兩階段）。
- **`repo.AgentChatTarget` 的 SQL（JOIN＋`COALESCE`）只有語法檢查、沒有對真實資料庫跑過。**

## 已過時的既有文件

以下文件仍寫著舊路由或舊機制，本次**未修改**，閱讀時請以本文為準：

- `AIAgent_Task.md`（`/agents/:id/run`）
- `AIAgent/02-api-and-data-model.md`（`/agents/:agent/run`）
- `agentic_ai_storyteller/Phase1至7工作項規劃.md`（`agentic-query` 端點、舊的 `agenticQuerySystemPrompt`）
