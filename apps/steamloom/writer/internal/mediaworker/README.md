# Media Worker adapter contract

新增 Worker 時只需註冊一個同時實作 `Adapter` 與 `Generator` 的型別；設定頁、Agent capability summary、動態 Job 表單與執行 lifecycle 都共用這份 contract。

## 必要行為

1. `Descriptor()` 宣告設定欄位；secret 只會保存於 OS Keychain。
2. `Discover()` 驗證連線並回傳 capabilities；`JobFields(settings)` 由 adapter 程式碼即時產生表單 schema（不落盤，adapter 改版即生效）。只有「啟用、online、實作 Generator」的 instance 會讓 Agent 看見。
3. Agent 只能回傳 `media.brief`（標準 prompt 與建議），不會取得 endpoint、token 或呼叫 Worker。
4. Writer 依 `JobFields` render 表單並驗證作者輸入，作者確認後才呼叫 `Generate()`。
5. `Generate()` 只能把產物寫入 Writer 傳入的 `outputDir`，回傳的 `LocalPath` 必須位於該目錄。Writer 會把結果 staging 成 `asset.upload` proposal，再讓作者選擇要上傳的成果。

目前 `asset.upload` 只接受 JPEG、PNG、WebP、GIF；音訊與影片要先擴充 SteamLoom asset contract，不能只在 adapter 宣告 media type。

`mockAdapter` 是最小可執行參考：它不呼叫外部服務，會產生 deterministic PNG，供完整 lifecycle 驗證。

`pixai.go` 是第一個串接外部 API 的 Generator 參考：`Discover()` 以查詢不存在的 task 驗證 key（有效 key 回 404、無效回 401），不送生成工作；`Generate()` 自帶 10 分鐘等待上限，完成後立即下載（PixAI 產物不會永久保存），下載 CDN 時不帶 API key。

## 已知 Bug 記錄

| 現象 | Root cause | 解法 | 狀態 |
|------|------------|------|------|
| 動態表單數字欄清空後送出 0（例如 seed 想留空隨機卻變成 0） | `MediaJobForm` 用 `Number(event.target.value)`，`Number("") === 0` | 清空時改存 `undefined`，後端改套預設值 | 已修 |
| Agent brief 的值不合 schema 時（如 `candidate_count: 2` 對到只接受 `"1"`/`"4"` 的 select、`aspect_ratio: "portrait"`），表單顯示空白、送出被擋「必須是文字／不是可用選項」 | `initialMediaJobInputs` 直接把 brief 原值塞進表單，沒依欄位型別轉換 | `fitJobValue` 依 kind 轉型、檢查 option 與範圍，不合就退回欄位預設值 | 已修 |
| adapter 改版後（新增欄位、改選項）既有 Worker 的表單仍是舊 schema，要重新連線測試才更新 | `Discover()` 回傳的 `JobFields` 被存進 workers.json | `JobFields(settings)` 改為 `Generator` 方法，每次即時由程式碼產生，不落盤 | 已修 |
| Worker 生成期間同一段對話無法繼續，新訊息排在生成後面 | 媒體提案的 apply 和對話 task 共用同一條 thread 佇列 | 媒體提案改為 `Task.Background`，每個提案一條獨立佇列；thread 的 `ActiveTaskID` 改為 claim/release，不互相覆寫 | 已修 |
| 生成失敗（例如非 Tsubaki 模型帶了 mode 被回 400）後只能請 Agent 重開提案 | `ConfigureMediaProposal` 只接受等待確認中的提案 | 新增 `RetryMediaProposal`：apply_failed 的媒體提案可換參數回到 approved 再排入背景佇列；Writer 重啟時中斷的生成也標成失敗而非「待確認」 | 已修 |
