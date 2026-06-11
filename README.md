# faryne.dev

這是一個個人側邊專案，使用 Go 語言並基於 [Fiber](https://gofiber.io/) 框架開發。專案整合了 API 服務、資料庫管理、排程任務（Cronjobs）以及前端靜態網站。

## 目錄結構說明

本專案遵循清晰的模組化架構，各目錄功能如下：

- `config`：放置與專案相關的 config 設定資訊（如環境變數定義）。
- `controller`：API 路由的具體實作邏輯。
- `migration`：資料庫遷移檔案（DB migration），目前使用 `sql-migrate` 工具，並區分 `localhost` 與 `master` 環境。
- `model`：定義資料表模型（Entities）或列舉（Enums）等資料結構。
- `repository`：負責資料表操作的程式碼實作（Data Access Layer）。
- `route`：定義專案中的 API 路由路徑與中間件掛載。
- `service`：商業邏輯（Business Logic）的實作層。
- `static_site`：前端網站的原始碼（React/Next.js 等）。
- `docs`：Swagger API 文件與相關說明文件。

## 排程任務 (Cronjobs)

本專案的排程任務定義於 `main.go` 的 `cronjob` 區塊中。開發者可以透過修改該區塊來新增或調整定時任務。

## 開發指令 (Makefile)

本專案提供 `makefile` 以簡化常用操作：

- `make mig-up`：執行資料庫遷移（localhost 環境）。
- `make mig-down`：回滾資料庫遷移（localhost 環境）。
- `make build-linux`：編譯 Linux 版本並同步至遠端伺服器。
- `make build-frontend`：建置前端網站並部署至 Firebase。

## MCP Server

專案提供基本 MCP server 架構，HTTP 服務啟動後可透過 `POST /mcp` 與支援 MCP 的 client 溝通：

```bash
curl -X POST http://localhost:8080/mcp \
  -H 'Content-Type: application/json' \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/list"}'
```

目前內建工具：

- `ping`：回傳 `pong`，用於確認 MCP server 存活。
- `server_info`：回傳 server 名稱、版本與 Go runtime 資訊。
- `av_video_search`：串接 `service/av.VideoSearch`。
- `av_actress_search`：串接 `service/av.ActressSearch`。

## 基礎設施

使用 Docker Compose 提供開發所需的基礎服務：

- **MySQL**: 埠號 `3307`
- **Manticore Search**: 搜尋引擎服務

可透過 `docker-compose up -d` 啟動。

## 注意事項

## 開發環境

- **語言**: Go 1.26+
- **框架**: Fiber v3
- **資料庫**: MySQL (Port 3307), Manticore Search (ES 相容), Redis
- **資料庫遷移工具**: `sql-migrate` (環境：`localhost`, `development`, `master`)
- **主要工具**: 
    - `godotenv`: 載入 `.env` 設定。
    - `cron`: 處理排程任務。
    - `swagger`: 自動生成 API 文件。

## 如何開始

1. 複製 `.env.example` 為 `.env` 並填入必要的設定值。
2. 使用 `go run main.go` 啟動後端服務。
3. 前端網站位於 `static_site` 目錄，請參考該目錄下的說明進行建置。
