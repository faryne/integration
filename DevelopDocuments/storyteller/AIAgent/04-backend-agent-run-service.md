# 後端 Agent 執行服務

## 目標

在 `service/storyteller` 實作 Agent run use case，完成權限驗證、prompt 組合、provider 呼叫與標準 API 回應。

## 工作項目

- 在 `service/storyteller` 中加入 Agent run/use case。
- 驗證 Agent 是否屬於目前登入使用者。
- 驗證故事是否屬於目前登入使用者。
- 根據 `mode` 組合 prompt。
- 呼叫 AI Provider。
- 回傳標準 API response。
- 若需要資料存取，將 CRUD 或查詢邏輯放在 `repository/`。

## 必要測試

- 有選取文字時的 prompt 組合。
- 只有全文時的 prompt 組合。
- Agent 不存在。
- Story 不屬於使用者。
- Provider 回傳錯誤。

## 專案規則

- business logic 放在 `service/`。
- 需要建立對應 `*_test.go`。
- Controller 保持 thin handler。

