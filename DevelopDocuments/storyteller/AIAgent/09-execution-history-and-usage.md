# 執行紀錄與 Usage 統計

## 目標

評估是否保存 Agent 執行紀錄、錯誤狀態與 token usage，作為除錯、統計或未來 UI 顯示用途。

## 工作項目

- 評估是否新增 Agent 執行紀錄資料表。
- 若新增資料表，規劃欄位：
  - user id
  - agent id
  - story id
  - provider
  - model
  - mode
  - instruction
  - input metadata
  - result 或 result 摘要
  - status
  - error message
  - token usage
  - created_at
- 決定是否保存完整故事內容。
- 決定是否需要前端查詢歷史紀錄。

## 注意事項

- migration 需放在 `migration/`。
- migration 需相容 MySQL 5.7.x。
- 若保存完整 input/output，需重新評估資料敏感性與儲存成本。

