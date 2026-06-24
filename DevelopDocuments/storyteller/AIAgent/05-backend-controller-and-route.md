# 後端 Controller 與 Route

## 目標

補上 Agent run API 的 HTTP handler、登入保護路由與必要文件。

## 工作項目

- 在 `controller/storyteller` 增加 thin handler。
- Handler 負責 request parsing、validation 與呼叫 service。
- 在 `route/` 註冊需登入路由。
- 使用 `faryne.dev/service/output` 作為標準 API response。
- 必要時補 Swagger docs。

## 驗證重點

- 未登入不可呼叫。
- request payload 格式錯誤時回傳合理錯誤。
- service error 能轉為一致 API response。
- 成功時 response payload 符合前端需求。

