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
| `STEAMLOOM_SKILL_URL` | AI 助理安裝／更新 Skill 的來源 | `http://localhost:8080/storyteller-mcp/skill.md` |

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
- 發佈版本：推 `steamloom-writer-v<版號>` tag，編譯完會建立 GitHub Release；app 版號以 tag 為準。含 `-alpha` 的 tag 會標記為不穩定內測版。

### 出新版號

1. 把 `VERSION` 改成完整 SemVer（例如 `0.2.1-alpha`）；`wails.json` 的 `info.productVersion` 保持對應的三段數字版（`0.2.1`），供 Windows／macOS native metadata 使用。
2. 確認新版需要的後端已經部署到正式站（Writer 預設連正式站）。
3. 在要發佈的 commit 上打 tag 並推上去，CI 會編譯五個平台並建立 Release：

```bash
git tag steamloom-writer-v0.2.1-alpha
```

```bash
git push origin steamloom-writer-v0.2.1-alpha
```

`0.2.0` 的 updater 預設忽略 GitHub prerelease，第一次切到 alpha channel 需手動安裝；安裝 `0.2.1-alpha` 後就會繼續檢查後續 alpha 更新。

macOS 版沒有簽名／notarization，第一次開啟要在 Finder 按右鍵選「打開」。

## 目錄

- `app.go`：綁定給前端呼叫的方法
- `internal/auth`：OAuth（PKCE＋loopback）與 token refresh
- `internal/tokenstore`：憑證存在系統鑰匙圈
- `internal/api`：呼叫網站的 `/storyteller` API（帶 Bearer token）
- `internal/agent`：偵測本機的 Claude Code／Codex／Grok Build／Gemini CLI／Antigravity，並透過共用事件協定送出問答
- `internal/skillupdate`：在「AI 助理」選擇工具時，替支援的 Agent 安裝或更新 SteamLoom Skill（唯一入口，Writer 啟動時不處理）
- `frontend/`：React 前端；主題與共用元件透過 `@steamloom-web` alias 直接 import `static_site/src`
