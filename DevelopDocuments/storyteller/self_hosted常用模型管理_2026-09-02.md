# self_hosted 常用模型管理

## 目的
使用 self_hosted provider 的 Agent／API Key 時，模型名稱沒有官方目錄可以同步，每次選模型都要手動貼上完整名稱。想在「選模型」的地方額外提供一份**綁定該把 API Key** 的常用模型清單，選過的名字記下來，下次直接點選；原本的文字輸入框保留，作為「清單裡沒有就直接新增一筆」的入口。

## 現況

- `AgentProviderModels`（[storyteller.go:127](model/entity/storyteller/storyteller.go:127)）是「每個 provider 一份」的**全域**目錄。self_hosted 這個 provider 的 `AllowCustomModel=true`、`Models` 永遠是空陣列——自架伺服器沒有統一型錄可以同步，這是設計上就沒有的東西，不是 bug。
- 目前輸入模型名稱的地方是**兩個各自獨立、純文字輸入框、不記憶任何歷史**的 UI：
  - AI 助理面板選模型選單，`providerAllowsCustomModel && modelOptions.length === 0` 分支（[StorytellerAgenticPanel.tsx:2425-2464](static_site/src/pages/storyteller/StorytellerAgenticPanel.tsx:2425)）。
  - API Key 管理頁的「測試連線」對話框，`needsTestModelName` 分支（[ApiKeyManagement.tsx:284-306](static_site/src/pages/storyteller/ApiKeyManagement.tsx:284)）。
- 兩處互不相通，也沒有任何地方把使用者貼過的模型名稱存下來。

## 資料模型（新增）

新表 `storyteller_provider_apikey_models`，比照現有 `ProviderAPIKey`／`AgentModel` 的欄位慣例：

```
id                 uint64 PK
provider_apikey_id uint64   -- FK storyteller_provider_apikeys.id
name               string   -- 使用者貼的模型名稱，原樣存
sort               int
created_at / updated_at / deleted_at (soft delete)
```

- Unique(`provider_apikey_id`, `name`)（軟刪除範圍內）——同一把 key 底下名稱不重複。
- 不需要 label/description/price：self_hosted 沒有這些中繼資料，使用者自己貼的就是純模型名稱。

## 後端 API（新增）

- `GET /storyteller/provider-apikeys/:apikey/models` — 依 sort/created_at 列出這把 key 綁定的模型清單。
- `POST /storyteller/provider-apikeys/:apikey/models`（`{name}`）— 新增一筆；已存在同名的直接回傳既有那筆（冪等，使用者重複輸入不報錯）。
- `DELETE /storyteller/provider-apikeys/:apikey/models/:model` — 真刪（不像故事版本那樣需要保留歷史）。

三支都要驗證 `provider_apikey_id` 屬於目前登入的 user，且該 key 的 `provider === self_hosted`——其他 provider 本來就有官方目錄，不開放這組 API，避免混淆「這是誰維護的清單」。

## 前端整合

- **AI 助理面板模型選單**：`providerAllowsCustomModel && modelOptions.length === 0` 分支改成先打 API 拿這把 key 的已存清單；清單非空時比照「有官方目錄」的 provider 顯示可點選清單，清單下方保留現有的「自訂模型名稱」輸入框；新增成功後同時 (a) 設成 `modelNameOverride`、(b) 呼叫新增 API 記進清單，下次選單就多這個選項。
- **API Key 管理頁測試連線對話框**：`needsTestModelName` 那組 UI 套用同一份清單邏輯（有清單顯示下拉、沒有才顯示輸入框）。
- 兩處建議抽成共用元件／hook（例如 `useSelfHostedModelOptions(apiKeyId)` + `SelfHostedModelPicker`），同一功能的兩個進入點只維護一份邏輯，改一邊不用記得改另一邊。
- 清單項目要有刪除按鈕（測試/打錯的名字要能清掉），沿用現有刪除確認的 UX 慣例。

## User Story

- 第一次幫某把 self_hosted key 選模型：打完名字送出，除了套用，這個名字也留在清單裡。
- 下次要用同一個模型：從清單直接點選，不用再打一次。
- 打錯字或模型已下架：從清單刪除。

## 常見 fail 應對

- 清單 API 失敗（例如網路問題）：退回目前「純文字輸入框」的行為，不阻擋既有功能。
- 新增重複名稱：後端冪等處理，不報錯。
- 這把 key 後來從 self_hosted 改成別的 provider：舊清單資料保留，不主動清除；因為 API 限定 `provider === self_hosted` 才開放操作，UI 上該 provider 不再顯示清單管理入口即可，不用特別遷移。

## 已定案（原「待確認」）

- 清單**不**顯示「最後使用時間」——這個資訊已經可以在用量報表（Usage）裡查到，不用在這裡重複做一份。
- 清單筆數**不限制**上限。
