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
- 發佈版本：推 `steamloom-writer-v<版號>` tag，編譯完會建立 GitHub Release；CI 會用 tag 的版號覆寫 `wails.json` 的 `info.productVersion`，app 資訊以 tag 為準。

### 出新版號

1. 把 `wails.json` 的 `info.productVersion` 改成新版號並 commit（只影響本機 `wails build`，保持跟 tag 一致比較不會搞混）。
2. 確認新版需要的後端已經部署到正式站（Writer 預設連正式站）。
3. 在要發佈的 commit 上打 tag 並推上去，CI 會編譯五個平台並建立 Release：

```bash
git tag steamloom-writer-v0.1.5
```

```bash
git push origin steamloom-writer-v0.1.5
```

macOS 版沒有簽名／notarization，第一次開啟要在 Finder 按右鍵選「打開」。

## 目錄

- `app.go`：綁定給前端呼叫的方法
- `internal/auth`：OAuth（PKCE＋loopback）與 token refresh
- `internal/tokenstore`：憑證存在系統鑰匙圈
- `internal/api`：呼叫網站的 `/storyteller` API（帶 Bearer token）
- `internal/agent`：偵測本機的 Claude Code／Codex／Grok Build，並送出問答
- `frontend/`：React 前端；主題與共用元件透過 `@steamloom-web` alias 直接 import `static_site/src`
