# 後端共通：已知 Bug 記錄

不屬於單一品牌（storyteller、galgame、nekomaid…）的後端問題記在這裡，供後續 AI agent 查閱。

## 找不到路由時回 HTTP 200 加上 `"Not Found"` 字串（2026-09-27，已修）

- **現象**：打到不存在的 API 路徑，例如 `GET /storyteller/totally-unknown-route`（已登入）或 `GET /totally-unknown-route`，回應是 `HTTP 200`，body 只有 `"Not Found"` 字串。前端 react-query 會當成成功，`response.data.data` 為 `undefined`，console 出現 "Query data cannot be undefined"。未登入時打 storyteller／galgame 的登入 group 會先被 `authsession` 擋下回 401，所以只有已登入時才看得到這個 200。
- **Root cause**：`main.go` 的 `ErrorHandler` 只對實作 `HttpCode()` 的 `output` 錯誤設定 status。其他錯誤一律 `ctx.JSON(err.Error())`，沒有設 status，所以是 200。Fiber 對沒有對應路由的請求會回傳 `fiber.ErrNotFound`（`*fiber.Error`），就落到這條路徑。同樣的問題也會讓 Fiber 自己產生的 405、413（body 太大）等錯誤回 200。
- **解法**：新增 `output.FromFiberError`。`ErrorHandler` 先把 `*fiber.Error` 轉成標準回應格式並保留原本的 HTTP status，自訂代碼的對應：
  - 404 → `404001`
  - 401 → `401001`
  - 5xx → `500000`
  - 其他 4xx → `400001`
- **影響範圍確認**：
  - 後端不負責 serve SPA 或靜態檔，沒有依賴「回 200」的 fallback。
  - SNS 用明確註冊的 `/sns/*` 路由，不受影響。
  - `/nekomaid/:site` 這類帶參數的路由本來就會命中，不受影響。
- **仍未處理**：handler 直接回傳一般 `error`（不是 `output` 錯誤，也不是 `*fiber.Error`）時，照樣會以 200 回傳錯誤字串。這種情況要改成 500，得先盤點各 controller 有沒有依賴這個行為，另開處理。
- **狀態**：已修（branch `fix/unmatched-route-404`）。
