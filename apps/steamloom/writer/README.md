# SteamLoom Writer

SteamLoom 的桌面寫作 app（Wails v2：Go main process ＋ React 前端）。

## 需求

- Go 1.26+
- Node 22＋pnpm
- Wails CLI：`go install github.com/wailsapp/wails/v2/cmd/wails@latest`

## 開發

```bash
wails dev
```

預設連到正式站 `https://steamloom.works`。要接本機後端時用環境變數覆寫：

| 變數 | 用途 | 本機值 |
|---|---|---|
| `STEAMLOOM_ISSUER` | OAuth server（register／token／revoke） | `http://localhost:8080` |
| `STEAMLOOM_API_BASE` | REST API 前綴 | `http://localhost:8080` |
| `STEAMLOOM_AUTHORIZE_URL` | 授權頁 | `http://localhost:5174/storyteller/oauth/authorize` |

```bash
STEAMLOOM_ISSUER=http://localhost:8080 STEAMLOOM_API_BASE=http://localhost:8080 \
STEAMLOOM_AUTHORIZE_URL=http://localhost:5174/storyteller/oauth/authorize wails dev
```

`wails dev` 也會在 `http://localhost:34115` 開一份可以從瀏覽器操作的版本（Go 綁定一樣能用）。

## 打包

```bash
wails build
```

輸出在 `build/bin/`。

## CI 與 Release

`.github/workflows/steamloom-writer.yml`：

- main 或 PR 有動到 Writer（或它共用的 static_site 檔案）才編譯，產物在該次 workflow 的 artifacts（保留 14 天）。
- 平台：macOS universal、Windows amd64／arm64、Linux amd64／arm64。
- 發佈版本：推 `steamloom-writer-v<版號>` tag，編譯完會建立 GitHub Release，版號同時寫進 app 資訊。

```bash
git tag steamloom-writer-v0.1.0
```

```bash
git push origin steamloom-writer-v0.1.0
```

macOS 版沒有簽名／notarization，第一次開啟要在 Finder 按右鍵選「打開」。

## 目錄

- `app.go`：綁定給前端呼叫的方法
- `internal/auth`：OAuth（PKCE＋loopback）與 token refresh
- `internal/tokenstore`：憑證存在系統鑰匙圈
- `internal/api`：呼叫網站的 `/storyteller` API（帶 Bearer token）
- `frontend/`：React 前端；主題與共用元件透過 `@steamloom-web` alias 直接 import `static_site/src`
