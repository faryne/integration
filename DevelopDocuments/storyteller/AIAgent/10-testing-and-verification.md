# 測試與驗證

## 目標

確保 AI Agent 功能從後端 service 到前端 editor 操作都能被驗證。

## 後端測試

- Service unit tests。
- Prompt 組合測試。
- Agent 權限測試。
- Story 權限測試。
- Provider 成功與錯誤測試。
- Controller/API 基本測試或手動驗證。

## 前端驗證

- 前端 build 檢查。
- 編輯器手動驗證：
  - 選取文字後呼叫改寫
  - 未選取文字時使用全文續寫
  - AI 回應取代選取文字
  - AI 回應插入游標位置
  - AI 回應附加到章節末尾
  - AI 回應複製結果
  - Provider 錯誤顯示

## 建議驗收順序

1. 後端 service unit tests 通過。
2. API 手動呼叫成功。
3. 前端 build 通過。
4. 編輯器最小流程可完成一次 Agent 呼叫。
5. 回應套用操作全部可用。

