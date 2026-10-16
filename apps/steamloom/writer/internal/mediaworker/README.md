# Media Worker adapter contract

新增 Worker 時只需註冊一個同時實作 `Adapter` 與 `Generator` 的型別；設定頁、Agent capability summary、動態 Job 表單與執行 lifecycle 都共用這份 contract。

## 必要行為

1. `Descriptor()` 宣告設定欄位；secret 只會保存於 OS Keychain。
2. `Discover()` 驗證連線、回傳 capabilities 與 `JobFields`。只有「啟用、online、具 schema、實作 Generator」的 instance 會讓 Agent 看見。
3. Agent 只能回傳 `media.brief`（標準 prompt 與建議），不會取得 endpoint、token 或呼叫 Worker。
4. Writer 依 `JobFields` render 表單並驗證作者輸入，作者確認後才呼叫 `Generate()`。
5. `Generate()` 只能把產物寫入 Writer 傳入的 `outputDir`，回傳的 `LocalPath` 必須位於該目錄。Writer 會把結果 staging 成 `asset.upload` proposal，再讓作者選擇要上傳的成果。

目前 `asset.upload` 只接受 JPEG、PNG、WebP、GIF；音訊與影片要先擴充 SteamLoom asset contract，不能只在 adapter 宣告 media type。

`mockAdapter` 是最小可執行參考：它不呼叫外部服務，會產生 deterministic PNG，供完整 lifecycle 驗證。
