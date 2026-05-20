# Agent Guide

你好，我是這份文件的維護者。這份文件是專門為你（AI Agent）準備的開發指南，旨在幫助你快速理解專案架構並遵守開發規範。本檔案已移動至 `.junie/Agent.md`。

## 專案核心目標

`faryne.dev` 是一個整合性的 Web 應用，提供開放資料 API（如 ETF 資訊）、工具介面以及前端展示。

## 開發規範與目錄守則

當你進行開發、修改或分析時，請嚴格遵守以下目錄定義：

- **核心業務邏輯**
    - `service/`：商業邏輯的核心，所有複雜運算、資料處理都應放在這裡。
    - `repository/`：資料庫存取層，僅負責 CRUD 操作。
    - `model/`：定義資料結構、Entity 與 Enum。
- **網路通訊**
    - `route/`：路徑定義與入口。
    - `controller/`：處理請求參數驗證與呼叫對應的 Service。
- **基礎設施**
    - `config/`：環境變數與全域配置。
    - `migration/`：資料庫版本控制。目前使用 `sql-migrate` 工具，環境分為 `localhost` 與 `master`。
- **前端與靜態資源**
    - `static_site/`：前端網站代碼。

## 嚴格禁止區 (Strictly Forbidden)

以下目錄包含舊程式碼或敏感資訊，**絕對禁止**在任何輸出的程式碼中引用，也不應向使用者以外的第三方暴露其內容：

1. `php7-version/`：舊版 PHP 程式碼，僅供開發者手動參考遷移邏輯，AI 不應主動修改或引用。
2. `secret_keys/`：存放私鑰等敏感資訊，開發時應使用環境變數代替。

## 技術棧指南 (Go 1.26+)

- **Fiber v3**: 請使用 Fiber v3 的語法特性。
- **現代 Go 慣用語**: 優先使用 `any` 而非 `interface{}`，使用 `slices` / `maps` 標準庫函數，使用 `errors.Is`/`As` 等。
- **Context**: 在測試中請使用 `t.Context()`。
- **JSON**: 優先使用 `omitzero` 標籤。

## 常見開發任務

- **資料庫遷移**: 使用 `sql-migrate`。
    - `make mig-up`: 升級資料庫。
    - `make mig-down`: 回滾資料庫。
- **搜尋引擎**: 專案使用 Manticore Search，在程式碼中通常透過 Elasticsearch client 進行操作（如 `client.InitElasticSearch`）。
- **新增 API**:
    1. 在 `model/` 定義結構。
    2. 在 `repository/` 實作資料存取。
    3. 在 `service/` 實作業務邏輯。
    4. 在 `controller/` 處理請求。
    5. 在 `route/` 註冊路由。
- **排程任務**: 在 `main.go` 的 `cronjob` 區塊中新增邏輯，並確保呼叫 `service` 層的方法。
