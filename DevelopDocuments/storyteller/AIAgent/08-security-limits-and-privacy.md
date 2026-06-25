# 安全性、限制與隱私

## 目標

避免 AI Agent 功能洩漏敏感資訊、消耗過多資源，或讓使用者存取不屬於自己的資料。

## 工作項目

- API key 不應回傳到前端。
- 限制 Agent prompt、章節全文、選取文字與臨時指令的 payload 大小。
- 處理 provider timeout。
- 處理 provider rate limit。
- 避免使用者呼叫不屬於自己的 Agent。
- 避免使用者以 story id 存取不屬於自己的故事。
- 若保存執行紀錄，確認是否保存完整故事內容。

## 決策點

- 是否保存完整 input/output。
- 是否只保存摘要、token usage 與狀態。
- 是否需要使用者可見的 usage 統計。
- 是否需要每日或每小時呼叫限制。

