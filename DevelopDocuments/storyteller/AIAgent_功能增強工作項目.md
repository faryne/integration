這裡會列出 AI Agent 的相關工作項目，我會列出我認為的工作項目及明細，請你依序做完後在前面打勾確認。

本次增加的工作項目方向如下：
- 增加 OpenAI / Claude / OpenRouter 的支援 
- AI Agent 的功能增強

建議你先處理 `AI Agent 的功能增強` 後再完成其他供應商的串接支援。

工作項目如下：
- [x] AI Agent 的提示詞增加編輯歷史功能。編輯歷史及歷史比對等功能皆與現有的故事/設定集編輯歷史對齊
- [x] AI Agent 的模型列表改用下拉選單，根據 AI 服務供應商調整。由後端維護這份資料，避免手寫填入出錯。但 OpenRouter 的模型列表暫時不支援（因為無法知道可用的模型列表。如果你有更好方法也可以跟我討論）
- [x] `story_chats` 資料表中的 `title` `metadata` 欄位還需要嗎？感覺直接用 `story_chat_messages` 就好？此外 `story_chats` 的 `deleted_at` 欄位應該也不需要才對，畢竟不需要刪除。
- [x] 先實作 OpenAI ChatGPT / Claude 支援
- [x] 接著再實作 OpenRouter 支援
- [x] 實作 Gemini 支援

## Agent API Key 加密與輪換設定

AI Agent 的 API Key 會使用類似 AWS KMS 的 envelope encryption 保存：
- 每筆 Agent API Key 使用隨機 data key 加密。
- data key 再使用目前 active master key 加密。
- `storyteller_agents.api_key_key_id` 會記錄當時使用哪一把 master key。
- 舊 key 需要保留在 keyring 內，才能解密尚未重新加密的舊資料。

### 初次設定

先產生一把 32 bytes master key：

```bash
openssl rand -base64 32
```

假設產生出的值是 `generated_base64_32_bytes_key`，環境變數設定如下：

```env
STORYTELLER_AGENT_API_KEY_ACTIVE_KEY_ID=v1
STORYTELLER_AGENT_API_KEY_MASTER_KEYS=v1:generated_base64_32_bytes_key
```

### 輪換 key

1. 產生新的 32 bytes master key：

```bash
openssl rand -base64 32
```

2. 將 active key 指向新版本，並保留舊 key：

```env
STORYTELLER_AGENT_API_KEY_ACTIVE_KEY_ID=v2
STORYTELLER_AGENT_API_KEY_MASTER_KEYS=v1:old_base64_32_bytes_key,v2:new_base64_32_bytes_key
```

3. 執行手動輪換 job，將既有 Agent API Key 重新加密到 active key：

```bash
go run main.go --cmd storyteller-rotate-agent-api-keys
```

4. 確認輪換成功後，才能移除舊 key：

```env
STORYTELLER_AGENT_API_KEY_ACTIVE_KEY_ID=v2
STORYTELLER_AGENT_API_KEY_MASTER_KEYS=v2:new_base64_32_bytes_key
```

### 注意事項

- 不要遺失任何仍在使用中的舊 master key，否則用該 key 加密的 Agent API Key 會無法解密。
- 輪換時必須先同時保留舊 key 與新 key，並等 `storyteller-rotate-agent-api-keys` 成功後再移除舊 key。
- 已部署環境的 env 變更後，需要重啟服務讓新 keyring 生效。
