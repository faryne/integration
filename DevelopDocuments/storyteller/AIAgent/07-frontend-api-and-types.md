# 前端 API 與型別

## 目標

補齊前端呼叫 Agent run API 所需的 API client、型別與 editor 狀態串接。

## 工作項目

- 在 `static_site/src/apis/storyteller.ts` 增加 Agent run mutation。
- 在 `static_site/src/types/storyteller.ts` 增加 Agent run request/response 型別。
- 讓 editor 元件可以取得：
  - 目前選取文字
  - 章節全文
  - selection start/end
  - cursor position
- 呼叫成功後將 AI 回應交給 editor 操作流程。

## 驗證重點

- TypeScript 型別能涵蓋後端 response。
- API error 能被 UI 顯示。
- 成功回應不會直接覆蓋使用者內容，需經使用者選擇套用方式。

