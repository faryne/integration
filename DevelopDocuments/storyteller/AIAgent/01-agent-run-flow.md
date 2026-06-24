# Agent 執行流程與 Prompt 規則

## 目標

定義故事編輯器呼叫 AI Agent 的最小可用流程。這份文件先處理「一次性 run」：使用者選擇 Agent、輸入臨時指令，系統帶入目前章節全文與選取文字，後端組合 prompt 後呼叫 provider，前端再讓使用者決定如何套用結果。

聊天歷史、new chat/history UI 與長期對話記錄先視為後續工作，不阻塞第一版 Agent run。

## 核心原則

- Agent 是使用者可重複使用的預設能力設定，主要內容來自 `default_prompt`。
- 每次 run 都必須包含使用者這次的臨時指令，避免 Agent 只靠預設 prompt 猜測任務。
- 後端負責組合最終 provider prompt，前端只提供結構化內容。
- AI 回應不得自動寫回故事；前端必須由使用者選擇套用方式。
- 前端傳入的 `full_content` 是使用者當下編輯器內容，可能尚未儲存，後端不得改用資料庫舊版內容取代它。
- 後端仍需驗證 Agent 與 Story 都屬於目前登入使用者。

## Agent Run Mode

第一版建議支援以下 `mode`：

| mode | 用途 | 必要輸入 | 預設套用建議 |
| --- | --- | --- | --- |
| `rewrite_selection` | 改寫選取文字 | `selected_content`, `selection_start`, `selection_end`, `instruction` | 取代選取文字 |
| `expand_selection` | 擴寫選取文字 | `selected_content`, `selection_start`, `selection_end`, `instruction` | 取代選取文字或插入游標 |
| `translate_selection` | 翻譯選取文字 | `selected_content`, `selection_start`, `selection_end`, `instruction` | 取代選取文字 |
| `continue_chapter` | 根據章節全文續寫 | `full_content`, `instruction` | 附加到章節末尾 |
| `custom_selection` | 用自訂指令處理選取文字 | `selected_content`, `selection_start`, `selection_end`, `instruction` | 取代選取文字、插入游標或複製 |
| `custom_chapter` | 用自訂指令處理章節全文 | `full_content`, `instruction` | 插入游標、附加到章節末尾或複製 |

第一版可以把 toolbar 的「使用 AI 改寫選取文字」映射到 `rewrite_selection`，右側 AI Agent 面板的「送出需求」依照有無選取文字映射到 `custom_selection` 或 `custom_chapter`。

## 輸入規則

- `instruction` 必須 trim 後非空。
- `full_content` 代表目前編輯器完整 Markdown 內容。
- `selected_content` 代表目前選取範圍的原文。
- `selection_start` 與 `selection_end` 使用 JavaScript textarea selection index，為 UTF-16 code unit offset。
- 若 mode 需要選取文字，`selected_content` 不可為空，且 `selection_start < selection_end`。
- 後端應檢查 `selected_content` 是否等於 `full_content[selection_start:selection_end]` 的語意等價內容；若 Go 與 JS offset 編碼處理成本太高，第一版至少由前端保證一致，後端僅驗證非空與範圍合理。
- 若 mode 需要章節全文，`full_content` 可為空字串，但 `instruction` 必須清楚指出任務；例如新章節開頭續寫。
- `story_public_id` 用於權限驗證與追蹤，不用於取得 provider prompt 的故事內容來源。

## Prompt 組合順序

後端將 provider prompt 分成 system 與 user 兩層。若 provider 只接受單一 prompt，則依相同順序串成純文字。

### System Prompt

System prompt 由系統固定規則加上 Agent 預設 prompt 組成：

```text
你是 Storyteller 的故事創作助手。請協助使用者處理故事文字。

規則：
- 遵守使用者建立此 Agent 時設定的用途、語氣與限制。
- 除非使用者要求分析，否則主要輸出可直接放回故事中的內容。
- 不要回傳與任務無關的前言、結語或解釋。
- 不要自行保存、公開或要求敏感資訊。

Agent 預設設定：
{{agent.default_prompt}}
```

### User Prompt

User prompt 依序包含 mode、臨時指令、章節全文、選取文字與輸出要求：

```text
任務模式：
{{mode}}

使用者這次的指令：
{{instruction}}

目前章節全文：
<<<STORY_FULL_CONTENT
{{full_content}}
STORY_FULL_CONTENT

目前選取文字：
<<<STORY_SELECTED_CONTENT
{{selected_content}}
STORY_SELECTED_CONTENT

輸出要求：
{{output_instruction_by_mode}}
```

若某個 mode 不需要 `selected_content`，仍可省略「目前選取文字」區塊。若某個 mode 不需要全文，建議仍保留全文作為上下文，但 provider payload 太大時可只傳選取文字前後摘要，這屬於後續最佳化。

## Mode 輸出要求

不同 mode 的 `output_instruction_by_mode`：

| mode | 輸出要求 |
| --- | --- |
| `rewrite_selection` | 只輸出改寫後文字，不要列版本、不解釋修改原因，保留原文語氣與 Markdown 結構。 |
| `expand_selection` | 只輸出擴寫後文字，不解釋修改原因，延續原文語氣與視角。 |
| `translate_selection` | 只輸出翻譯後文字，不附註解；目標語言依使用者指令判斷，未指定時翻成繁體中文。 |
| `continue_chapter` | 只輸出可接在章節末尾後的新內容，不重複章節全文。 |
| `custom_selection` | 依使用者指令輸出結果；若指令沒有要求分析，輸出應可直接套用到故事內容。 |
| `custom_chapter` | 依使用者指令輸出結果；若是續寫或改寫，不要重複整篇章節全文。 |

## 前端執行流程

1. 使用者在故事編輯頁選擇 Agent。
2. 使用者輸入臨時指令，或點擊 toolbar 的快捷動作帶入預設指令。
3. 前端讀取目前 `content`、`selectedText`、`selectionStart`、`selectionEnd`。
4. 前端依操作來源決定 `mode`。
5. 前端呼叫 Agent run API。
6. UI 顯示 loading，並避免同一個 Agent run 重複送出。
7. 成功後將結果顯示在 AI Agent 面板，不直接改寫 editor。
8. 使用者選擇套用方式。

## 前端套用方式

第一版建議提供以下 apply action：

| action | 行為 | 適用情境 |
| --- | --- | --- |
| `replace_selection` | 用 AI 結果取代 `selection_start` 到 `selection_end` 的內容 | 改寫、擴寫、翻譯、custom selection |
| `insert_at_cursor` | 在目前游標位置插入 AI 結果 | 自訂段落、補句、插入描寫 |
| `append_to_chapter` | 在章節末尾附加 AI 結果 | 續寫 |
| `copy_result` | 複製 AI 結果，不改 editor | 分析、建議、備用結果 |

若 run 完成後使用者又修改了 editor 內容，前端在執行 `replace_selection` 前應重新確認原 selection 範圍仍能對應原本的 `selected_content`。若無法確認，應停用取代操作或改要求使用者手動複製。

## 錯誤與空結果

- 未選擇 Agent：前端停用送出。
- Agent 停用或已刪除：後端回錯，前端顯示「此 Agent 不可用」。
- 需要選取文字但沒有選取：前端停用該 mode。
- `instruction` 空白：前端停用送出，後端仍需驗證。
- Provider timeout：前端顯示可重試錯誤，不清空使用者輸入。
- Provider rate limit：前端顯示限制訊息，不自動重試。
- Provider 回傳空字串：顯示 empty result 狀態，允許使用者重新送出。

## 第一版範圍

包含：

- Agent run mode 定義。
- Prompt 組合規則。
- 前端呼叫與套用流程。
- 錯誤與空結果處理規則。

不包含：

- 多輪 chat history。
- Agent run history 查詢 UI。
- token usage 統計 UI。
- provider model list 同步。
- 自動儲存 AI 套用後的故事內容。

## 下一步

依照這份流程規格，接續處理 `02-api-and-data-model.md`，定義具體 API route、request payload、response payload 與後端 DTO。
