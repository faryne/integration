# Storyteller Notion 風工作台交接

本文件記錄 `codex/storyteller-explorer-mockup` branch 目前的 Notion 致敬工作台進度，供後續接手實作參考。

## 目前狀態

- Branch：`codex/storyteller-explorer-mockup`
- 已 commit：`103b51d feat(storyteller): 新增 Notion 風工作台列表`
- `103b51d` 之後仍有未 commit 改動：主要是把作品編輯器嵌入工作台右欄，以及更激進的 Notion 風 inline 編輯 UI。
- 目前只改前端，沒有後端 migration / API 變更。

## 已完成

### 工作台 layout

- 新增專案工作台路由：
  - `/storyteller/my/workspace/:projectId`
  - `/storyteller/my/workspace/:projectId/story/:storyId`
  - `/storyteller/my/workspace/:projectId/image/:storyId`
- 左欄為 explorer 風格，包含：
  - 作品與冊
  - 設定集
  - 資產集
- 右欄依左欄選取顯示列表或編輯區。
- 麵包屑為 `SteamLoom > 我的工作台 > 專案名稱`。
- 專案名稱點擊後顯示其他專案，可切換專案。
- 專案切換列表已調整：
  - click 開啟，不使用 hover。
  - 每個專案用水平線分隔。
  - 不顯示 slug / public id / token。
  - 顯示最後更新時間。

### 列表功能

- 作品列表：
  - 分頁。
  - 建立故事 / 圖像入口仍走舊路由。
  - 新增冊。
  - 作品公開 / 草稿切換。
  - 移動作品到冊。
  - 編輯 icon 已改連到 workspace 子路由。
  - 刪除作品。
- 冊：
  - 編輯 / 刪除 icon 放在冊名稱旁。
  - 公開冊 / 草稿冊切換放在冊名稱旁。
  - 公開狀態色系改用網站主色系，不再使用語意綠。
- 設定集列表：
  - 分頁。
  - 建立分類。
  - 建立設定集仍走舊路由。
  - 移動設定集到分類。
  - 編輯 / 刪除設定集。
  - 分類編輯 / 刪除 icon 放在分類名稱旁。
- 資產集列表：
  - 分頁。
  - 搜尋。
  - 重新整理。
  - 建立資產集。
  - 圖像上傳，含進度與離開頁面警告。
  - 移動資產到資產集。
  - 編輯資產資訊。
  - 刪除資產。
  - 資產集編輯 / 刪除 icon 放在資產集名稱旁。

### 工作區視覺

- Footer 色系切換可套用到新版工作台 layout。
- 新增第 11 款色系：`素白`。
  - light mode 以白色、灰階與高辨識藍為基底。
  - dark mode 有對應深色 token。
- 工作區內 dialog 改成扁平風格：
  - 冊編輯 dialog。
  - 設定集分類 / 資產集 dialog。
  - 刪除確認 dialog。
  - 資產資訊編輯 dialog。
- 工作區 empty state 改成低存在感的虛線框樣式，不再使用全站通用大色塊卡片。

### 作品編輯器嵌入

- 文字故事：
  - workspace 子路由可直接開右欄編輯器。
  - 點列表列或編輯 icon 會進入 `/my/workspace/:projectId/story/:storyId`。
  - 右欄直接使用既有 `StoryEditor` 的存檔 / WYSIWYG / 資產插入 / AI panel / history 功能。
  - embedded 模式不顯示內層 breadcrumb。
  - embedded 模式使用 `StorytellerShell` 的 `plain` 模式，拿掉內層蒸汽面板外殼。
  - 標題改成大字 inline editable。
  - 摘要改成無框 inline textarea。
  - 狀態改成 icon + dropdown。
  - 冊分配改成 folder icon + dropdown。
  - 自動存檔頻率已補回，改成 schedule icon + dropdown。
  - 自訂頻率仍保留 number input。
  - 存檔 button 放在右上 action。
- 圖像作品：
  - workspace 子路由可直接開右欄編輯器。
  - 點列表列或編輯 icon 會進入 `/my/workspace/:projectId/image/:storyId`。
  - embedded 模式不顯示內層 breadcrumb。
  - embedded 模式使用 `StorytellerShell` 的 `plain` 模式。
  - 話名稱改成 inline editable。
  - 描述改成無框 inline textarea。
  - 狀態與冊分配改成 icon + dropdown。
  - 上傳 / 儲存 action 放在右上。
  - 內部舊表單 Paper 在 embedded 模式下改成透明。
  - embedded 存檔後不跳回舊管理頁列表。

## 目前主要檔案

- Route：
  - `static_site/src/App.tsx`
- 工作台主體：
  - `static_site/src/pages/storyteller/ProjectWorkspacePreview.tsx`
  - `static_site/src/pages/storyteller/ProjectWorkspacePreviewComponents.tsx`
  - `static_site/src/pages/storyteller/ProjectWorkspacePreviewRows.tsx`
  - `static_site/src/pages/storyteller/ProjectWorkspacePreviewActions.tsx`
  - `static_site/src/pages/storyteller/ProjectWorkspacePreviewActionParts.tsx`
  - `static_site/src/pages/storyteller/ProjectWorkspacePreviewDialogStyles.ts`
  - `static_site/src/pages/storyteller/ProjectWorkspacePreviewTypes.ts`
- Workspace inline editor controls：
  - `static_site/src/pages/storyteller/ProjectWorkspaceEditorControls.tsx`
- 既有編輯器 embedded 支援：
  - `static_site/src/pages/storyteller/StoryEditor.tsx`
  - `static_site/src/pages/storyteller/ImageEpisodeEditor.tsx`
  - `static_site/src/pages/storyteller/StorytellerShell.tsx`
- 色系：
  - `static_site/src/data/storytellerTheme.ts`
  - `static_site/src/components/storyteller/SteamPaletteSwitcher.tsx`

## 驗證紀錄

最近已跑過：

```bash
cd static_site
pnpm exec tsc -b
pnpm exec eslint -c eslint.config.js ...
git diff --check
```

也做過 Vite route smoke test：

```bash
curl -I http://127.0.0.1:5175/storyteller/my/workspace/c485bf1f3cd2bfdd-aaaa/story/d67fbb0d1aa0af83
```

結果：`200 OK`。

## 待處理 / 建議下一步

- 尚未 commit 的 embedded editor 改動需要繼續驗收後再 commit。
- 工作台新建作品尚未改成 workspace 子路由：
  - 目前 `建立故事` / `建立圖像` 仍走 `/my/project/:id/story/new`、`/my/project/:id/image/new`。
  - 若要完整 Notion 風，需要新增 `/my/workspace/:id/story/new`、`/my/workspace/:id/image/new` 或其他建立流程。
- 設定集 editor 尚未嵌入右欄：
  - 現在設定集編輯仍走舊 `/my/project/:id/lore/:loreId`。
  - 若要接續，建議比照 StoryEditor，先加 `embedded/projectId/lorePublicId` props。
- 資產點擊仍偏資訊預覽 / modal 型，不是完整右欄 detail page。
  - 可考慮建立 workspace asset detail panel。
- 直接開不存在的 workspace story/image 子路由，目前會回到列表狀態，尚未做右欄 404。
- `StoryEditor.tsx` 與 `ImageEpisodeEditor.tsx` 都已超過 500 行。
  - 目前為了快速驗證採最小嵌入改法。
  - 若 Notion 方向確認，建議下一階段拆：
    - 資料 hook。
    - legacy shell。
    - workspace embedded shell。
    - 共用 editor body。
- 工作台右欄 embedded editor 的手機版體驗尚未詳細驗收。
- Notion 風目前主要靠 inline input / dropdown / plain shell，還沒有做到真正 block-based editor。
  - 這點先不要過度擴張，WYSIWYG 核心仍沿用現有 `StorytellerWysiwygEditor`。

## 交接注意

- `projectId` 必須使用完整 `public_id`，例如 `c485bf1f3cd2bfdd-aaaa`，不要截掉後綴。
- workspace 子路由使用 `storyId` 作為 path param；圖像作品也沿用 story public id。
- 舊路由仍保留，不要移除：
  - `/my/project/:id/story/:storyId`
  - `/my/project/:id/image/:episodeId`
  - `/my/project/:id/lore/:loreId`
- 目前沒有改後端，不需要 migration。
