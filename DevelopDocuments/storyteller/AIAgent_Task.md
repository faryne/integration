# AI Agent 工作項目

## 我對需求的理解

在 storyteller 專案中，AI Agent 的意義不是單一固定功能，而是讓使用者自行定義用途的故事創作助手。使用者建立 Agent 時，透過 prompt 描述這個 Agent 的能力、語氣、限制或任務；在故事編輯時，系統會把目前章節全文、選取文字或兩者組合成上下文傳給 Agent，讓 Agent 協助完成改寫、擴寫、翻譯、續寫或其他由使用者定義的文字處理工作。

因此核心設計重點是：

- Agent 是使用者定義的可重複使用設定。
- Agent 執行時需要知道「使用者這次想做什麼」與「要處理哪一段故事內容」。
- AI 回應應能回到正在編輯的故事區段中，讓使用者決定插入、取代、複製或再修改。
- 後端需要保留可替換 AI 供應商的能力，目前優先支援 Grok。

## 可能需要進行的工作項目

### 1. 釐清 Agent 執行流程

- 定義故事編輯器中呼叫 Agent 的操作情境：
  - 對選取文字改寫
  - 對選取文字擴寫
  - 對選取文字翻譯
  - 根據章節全文續寫
  - 使用自訂指令處理章節全文或片段
- 定義使用者每次呼叫 Agent 時可輸入的臨時指令。
- 定義 Agent 預設 prompt、臨時指令、章節全文、選取文字之間的組合順序。
- 定義 AI 回應在前端的處理方式：
  - 取代選取文字
  - 插入游標位置
  - 附加到章節末尾
  - 只複製結果

### 2. 補齊資料模型與 API 規格

- 檢查既有 `storyteller_agents` 欄位是否足以支援實際呼叫。
- 規劃 Agent 執行 API，例如：
  - `POST /storyteller/agents/:id/run`
  - 或掛在故事底下：`POST /storyteller/projects/:project/stories/:story/agents/:id/run`
- 定義 request payload：
  - `story_public_id`
  - `instruction`
  - `full_content`
  - `selected_content`
  - `selection_start`
  - `selection_end`
  - `mode`
- 定義 response payload：
  - `result`
  - `provider`
  - `agent_id`
  - `usage`
  - `finish_reason`
- 評估是否需要保存 Agent 執行紀錄，包含輸入、輸出、狀態、錯誤、token usage。

### 3. 建立 AI Provider 抽象層

- 在 service 層建立 AI Provider interface。
- 先實作 Grok provider。
- 保留未來接入其他 provider 的欄位與程式邊界。
- 統一處理：
  - API key 來源
  - model 名稱
  - timeout
  - 錯誤格式
  - token 或請求量限制
  - provider 回應格式轉換

### 4. 實作 Agent 執行服務

- 在 `service/storyteller` 中加入 Agent run/use case。
- 驗證 Agent 是否屬於目前登入使用者。
- 驗證故事是否屬於目前登入使用者。
- 根據 mode 組合 prompt。
- 呼叫 AI Provider。
- 回傳標準 API response。
- 建立 `*_test.go` 覆蓋主要 business logic：
  - 有選取文字時的 prompt 組合
  - 只有全文時的 prompt 組合
  - Agent 不存在
  - Story 不屬於使用者
  - Provider 回傳錯誤

### 5. 實作後端路由與控制器

- 在 `model/` 定義 request/response DTO。
- 在 `controller/storyteller` 增加 thin handler。
- 在 `route/` 註冊需登入路由。
- 使用 `faryne.dev/service/output` 作為標準 API response。
- 必要時補 Swagger docs。

### 6. 更新故事編輯器 AI Agent 介面

- 在故事編輯頁提供 Agent 選擇。
- 顯示目前 Agent 的用途、provider 與描述資訊。
- 支援對選取文字呼叫 Agent。
- 支援對全文或當前章節呼叫 Agent。
- 提供臨時指令輸入區。
- 顯示 loading、error、empty result 狀態。
- 顯示 AI 回應結果，並提供：
  - 取代選取文字
  - 插入目前游標位置
  - 附加到章節末尾
  - 複製結果

### 7. 更新前端 API 與型別

- 在 `static_site/src/apis/storyteller.ts` 增加 Agent run mutation。
- 在 `static_site/src/types/storyteller.ts` 增加 Agent run request/response 型別。
- 讓 editor 元件可以取得目前選取文字與章節全文。
- 呼叫成功後更新編輯器內容，但不要自動儲存，除非使用者明確觸發儲存。

### 8. 安全性與限制

- API key 不應回傳到前端。
- Agent prompt 與故事內容可能很長，需要限制 payload 大小。
- 需要處理 provider timeout 與 rate limit。
- 需要避免使用者呼叫不屬於自己的 Agent。
- 若保存執行紀錄，需確認是否保存完整故事內容，避免不必要的敏感內容落庫。

### 9. 測試與驗證

- 後端 service unit tests。
- Controller/API 基本測試或手動驗證。
- 前端 build 檢查。
- 編輯器手動驗證：
  - 選取文字後呼叫改寫
  - 未選取文字時使用全文續寫
  - AI 回應取代選取文字
  - AI 回應插入游標位置
  - Provider 錯誤顯示

## 建議優先順序

1. 先定義 Agent run API 與 prompt 組合規則。
2. 實作後端 Agent run service 與 Grok provider 抽象。
3. 實作故事編輯器呼叫 Agent 的最小可用流程。
4. 補上回應插入/取代/複製等編輯器操作。
5. 再評估是否需要 Agent 執行紀錄、usage 統計與更細緻的 provider 設定。
