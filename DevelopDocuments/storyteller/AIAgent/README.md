# Storyteller AI Agent 工作項目拆分

此目錄由 `AIAgent_Task.md` 拆分而來，依照不同實作領域整理成可獨立指派與執行的工作項目檔案。

## 建議優先順序

1. [x] `01-agent-run-flow.md`
2. [x] `02-api-and-data-model.md`
3. [x] `03-ai-provider-abstraction.md`
4. [x] `04-backend-agent-run-service.md`
5. [x] `05-backend-controller-and-route.md`
6. [x] `07-frontend-api-and-types.md`
7. [x] `06-frontend-editor-agent-ui.md`
8. [x] `08-security-limits-and-privacy.md`（部分完成，處理字數限制部分）
9. [ ] `10-testing-and-verification.md`
10. [ ] `09-execution-history-and-usage.md`

## 檔案列表

- `01-agent-run-flow.md`: Agent 執行情境、mode 與 prompt 組合規則。
- `02-api-and-data-model.md`: API contract、DTO、資料模型與 migration 評估。
- `03-ai-provider-abstraction.md`: AI Provider interface 與 Grok provider。
- `04-backend-agent-run-service.md`: 後端 Agent run business logic。
- `05-backend-controller-and-route.md`: HTTP handler、route 與 Swagger。
- `06-frontend-editor-agent-ui.md`: 故事編輯器 Agent UI 與回應套用操作。
- `07-frontend-api-and-types.md`: 前端 API client、TypeScript 型別與 editor 狀態串接。
- `08-security-limits-and-privacy.md`: 權限、payload 限制、timeout、rate limit 與隱私。
- `09-execution-history-and-usage.md`: 執行紀錄與 usage 統計評估。
- `10-testing-and-verification.md`: 後端測試、前端 build 與手動驗證。

