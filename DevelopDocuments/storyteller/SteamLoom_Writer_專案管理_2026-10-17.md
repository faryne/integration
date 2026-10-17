# SteamLoom Writer：建立／編輯／刪除專案

> 狀態：規格草稿，待確認後實作。Mockup：`writer-project-management-mockup/index.html`

## 結論

Writer 直接沿用網站的專案表單與刪除確認，**不另刻 UI**：

- 後端 `POST／PUT／DELETE /storyteller/projects` 沒有掛 `sessionOnly`，Writer 的 OAuth Bearer token 打得到，權限與網站登入相同（無 scope 限制）。
- Writer 已有 `WebApiProvider`：網站的 axios＋react-query hook 經 Go `ApiProxy` 帶 Bearer 轉發，`useSaveStorytellerProject`／`useDeleteStorytellerProject`／`useStorytellerAccountLimits` 可直接用，Go 端不用新增 API。
- 唯一跑不了的是**封面上傳**：網站用 S3 presign 直傳，`ApiProxy` 只轉發 JSON。改由 Writer 注入既有的 `UploadAssets`（原生選檔＋Go 上傳）。

## 現況

- `ProjectsPage.tsx` 只列專案；零專案只顯示「還沒有專案」，沒有任何操作 → 新帳號開 Writer 會卡住（AI 助理也只能在專案內開）。
- `ProjectCard.tsx` 點下去只能進入專案，沒有選單。
- 專案列表只回傳作者自己的專案（RBAC 尚未實作），列出的專案都可編輯、刪除。

## 範圍

| 功能 | 入口 | 沿用網站 |
|---|---|---|
| 建立專案 | 我的專案標題列「建立專案」；零專案空狀態的「建立專案」 | `NewProject.tsx`（建立模式）＋建立成功的梭梭對話框 |
| 編輯專案 | 專案卡片「⋯」選單 →「編輯專案」 | `NewProject.tsx`（編輯模式，含「封面圖設定」分頁與「變更專案網址」確認） |
| 切換公開狀態 | 專案卡片「⋯」選單 → 設為私密／分享／公開 | `HomeCards.tsx` 同一組選項（PUT 整包、不帶封面欄位＝不變） |
| 刪除專案 | 專案卡片「⋯」選單 →「刪除專案」 | `StorytellerConfirmNameDialog`（輸入專案名稱確認）；後端 soft delete |

規則照網站：專案上限（免費 3 個）只擋建立；建立時網址代稱由名稱產生、建立後才能改；刪除為 soft delete。

## 做法

1. **`NewProject.tsx` 改成可注入**（網站行為不變）：新增選用 props
   - `projectId`：取代 `useParams()` 的 `id`
   - `onCreated(projectId, next: "story" | "home")`、`onSaved(projectId)`、`onCancel()`：取代內部 `navigate(steamloomPath(...))`
   - 沒傳時維持現在的網址導向，網站兩個使用處（`Home.tsx`、`ProjectWorkspacePreview.tsx`）不用改。
2. **封面上傳注入**：`StorytellerEditorData` 加選用的 `pickAndUploadImage(projectPublicId)`；`StorytellerProjectCoverEditor` 有注入就呼叫它，沒有就維持 `useUploadStorytellerAssets`。Writer 在專案表單外層提供 context，實作呼叫 `backend.UploadAssets`。
3. **專案卡片選單**：把 `HomeCards.tsx` 的專案選單與刪除確認抽成共用元件（例如 `StorytellerProjectMenu`），網站首頁與 Writer `ProjectCard` 共用。
4. **Writer 頁面**：`App.tsx` 新增 `projectForm: { mode: "create" } | { mode: "edit", id }` 狀態；表單頁麵包屑「我的專案 / 建立專案」或「我的專案 / 〈專案名〉/ 編輯專案」。存檔成功、刪除成功後重抓 `backend.Projects()`。
5. 建立成功的「建立第一篇故事」→ 開啟該專案工作台並觸發新增故事；「回專案首頁」→ 開啟工作台。

## 影響檔案

- 網站（共用）：`static_site/src/pages/storyteller/NewProject.tsx`、`StorytellerProjectCoverEditor.tsx`、`StorytellerEditorDataContext.ts`、`HomeCards.tsx`、新增共用的專案選單元件
- Writer：`frontend/src/App.tsx`、`pages/ProjectsPage.tsx`、`pages/ProjectCard.tsx`、新增 `pages/ProjectFormPage.tsx`（包網站表單＋麵包屑＋上傳注入）、i18n
- Go：無（沿用 `ApiProxy`、`UploadAssets`）

## User stories

- 新作者第一次開 Writer、沒有任何專案 → 空狀態按「建立專案」→ 填名稱 → 建立成功 → 直接進工作台開始寫。
- 作者想改專案名稱或封面 → 卡片選單「編輯專案」→ 改完存檔 → 回到我的專案，卡片已更新。
- 作者想把專案公開 → 卡片選單「設為公開」，不用進表單。
- 作者刪除不要的專案 → 輸入專案名稱確認 → 卡片消失；網站上同步消失（soft delete）。

## 常見失敗與應對

| 情境 | 處理 |
|---|---|
| 已達專案上限 | 建立按鈕仍可點，進表單顯示網站同一則警告、送出鈕停用（與網站一致） |
| 網址代稱撞到自己的其他專案 | 後端回錯誤訊息，表單上方顯示（網站既有行為） |
| 授權失效（401） | `WebApiProvider` 既有流程：回登入頁 |
| 網路錯誤、儲存／刪除失敗 | SNACK 提示，表單內容保留 |
| 封面上傳失敗或取消選檔 | 取消不提示；失敗用封面編輯器既有的 snack |
| 在網站上同時刪掉專案 | Writer 重新整理列表時消失；正在編輯會在儲存時收到 404 錯誤提示 |
| 刪除的專案在 Writer 有本機 AI 對話紀錄 | 保留在本機不動（soft delete 可由站方復原）；見待確認 #2 |

## 不做

- 專案層級 RBAC（共用專案的權限）——之後依 `docs/storyteller-rbac-review-summary` 規劃；屆時編輯／刪除要依角色顯示。
- 工作台內的「專案設定」入口（先只放在我的專案）。
- 專案復原（soft delete 的還原目前只有站方後台）。

## 待確認

1. 工作台裡要不要也放「專案設定」入口？（網站工作台有內嵌編輯）——草稿先不放。
2. 刪除專案時，要不要一併清掉 Writer 本機該專案的 AI 對話紀錄？——草稿先保留。
