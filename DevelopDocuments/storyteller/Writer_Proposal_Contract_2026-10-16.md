# SteamLoom Writer Proposal／Artifact／Lifecycle Contract

## 目標

Writer 是發令、審查與套用介面。Provider adapter 只負責執行工作並回傳正規化事件與成果；任何 SteamLoom 寫入都由 Writer 在使用者核准後進行。

## Proposal 類型

| type | 用途 | Writer 套用方式 |
|---|---|---|
| `document.create` | 新故事／設定全文 | 建立新文件 |
| `document.replace` | 更新既有故事／設定全文 | base version 驗證後存新版本 |
| `chapter.append` | 在指定 anchor 後新增章節 | 驗證 anchor 與 base 後插入章節 |
| `chapter.replace` | 替換指定 marker 章節 | 只替換指定章節 |
| `asset.upload` | 上傳單一或多個可重用媒體資產 | staging 驗證後上傳資產 |
| `image_story.create` | 以圖片候選建立圖像作品 | 上傳資產後依順序建立圖像作品 |
| `image_story.update` | 修改既有圖像作品頁面 | base version 驗證後更新頁面清單 |

搜尋取代與任意段落修改在第一階段正規化為 `document.replace`；若可可靠對應單一 marker，才使用 chapter proposal。

## Artifact contract

Provider 不得回傳任意可直接執行的寫入命令。媒體成果先搬入 Writer 管理的 staging 目錄，保存：

- provider、provider job id、模型與生成參數
- MIME type、檔名、大小、SHA-256
- 本機 staged path 與 preview
- 圖片 dimensions；音訊 duration；其他媒體的型別 metadata
- 候選群組、預設選取狀態及使用者最後選取結果

## Lifecycle 原則

- 所有會影響重開 Writer 後狀態的事件必須 append-only 落盤。
- live stream event 只供畫面即時預覽，不作為終局事實。
- UI 以集中 registry 決定每個事件是獨立顯示、聚合顯示或 live-only；未知 persisted event 必須顯示「未支援事件」，不能靜默 fallback。
- apply 逐 item 保存結果；批次中途失敗時，不重送已完成 item。
- REST 結果不明時進入 `apply.interrupted`，只能查證／人工確認，不能自動重送。

## Adapter capability

Provider 以 capability 宣告功能，不假設都有聊天 thread：

- `conversation`
- `image.generate`
- `audio.generate`
- 未來可加入 `video.generate`

共用 adapter 介面涵蓋：偵測／驗證登入、列出模型與參數、submit、stream 或 poll、cancel、resume、收集 artifact。Provider-specific payload 不可滲入 proposal apply layer。
