# HTTP 客户端迁移計劃

**状态**: 已創建通用 HTTP 客户端，開始迁移分析  
**创建时间**: 2026-06-28  

---

## 📊 迁移分析

掃描结果：共 **27 个文件** 使用了 HTTP 调用

### 分類統計

| 類型 | 文件數 | 難度 | 優先級 |
|------|--------|------|--------|
| **JSON API（直接迁移）** | 5 | 🟢 低 | 🔴 高 |
| **HTML 解析（需改動）** | 3 | 🟡 中 | 🟡 中 |
| **複雜認証（需特殊處理）** | 8 | 🔴 高 | 🟢 低 |
| **自定義客户端（暫不迁移）** | 11 | 🔴 高 | 🟢 低 |

---

## 🟢 第一優先級：直接迁移（JSON API）

### 已完成
- ✅ `service/dmm/client.go` - DMM GraphQL API

### 可迁移
1. **`service/av/search.go`** - 需要檢查
2. **`service/nccc/download.go`** - HTTP 下載
3. **`service/crawler/function.go`** - 簡單爬蟲
4. **`service/screenshot/screenshot.go`** - 可能的簡單 API

### 迁移方式
```go
// 使用新的 HTTP 客户端
result, err := client.DefaultHTTPClient().Do[ResponseType](
    http.MethodGet,
    url,
    params,
    nil,
)
```

---

## 🟡 第二優先級：需要改動

### `service/xcity/request.go`
- **問題**: 需要返回 `*http.Response` 用於 goquery 解析
- **解决方案**: 添加新方法 `DoRaw()` 返回 `*http.Response`
- **影響**: `functions.go` 需要跟著改

### `service/fire_department/` 等
- 類似的 HTML 解析需求

---

## 🔴 第三優先級：複雜情況（不立即迁移）

### Pixiv/Nico 認証（`service/nekomaid/`）
```go
// 這些需要 Cookie jar、複雜的認証流程
- pixiv.go      // Pixiv 登錄 + API
- nico.go       // Nico 登錄 + API
```

**原因**: 
- 需要維持会话状態
- Cookie 管理很關鍵
- 認証邏輯複雜

**建議**: 
- 暫時保留
- 或改進新 HTTP 客户端支持 Cookie jar

### Discord/Firebase（`service/discord/`, `service/auth/`）
- 已有特定的認証需求
- 改動風險較大

---

## 📋 建議迁移順序

### 第 1 步：快速勝利（30分鐘）
```
✅ service/dmm/client.go - 已完成
```

### 第 2 步：JSON API（1小時）
- [ ] `service/av/search.go` - 檢查並迁移
- [ ] `service/nccc/download.go` - 檢查並迁移

### 第 3 步：擴展 HTTP 客户端（可選）
- [ ] 添加 `DoRaw()` 方法返回 `*http.Response`
- [ ] 迁移 HTML 解析代碼

### 第 4 步：驗證（必需）
- [ ] 運行 API 測試
- [ ] 檢查性能
- [ ] 處理錯誤情況

---

## 🔧 需要做的改進

### 新增方法：DoRaw()
對於需要訪問原始響應的情況：

```go
func (h *HTTPClient) DoRaw(
    method string,
    uri string,
    query url.Values,
    body io.Reader,
) (*http.Response, error) {
    // 返回原始 *http.Response，調用者負責 Close
}
```

### 支持 Cookie Jar
```go
func NewHTTPClientWithJar(jar http.CookieJar) *HTTPClient {
    return &HTTPClient{
        client: &http.Client{Jar: jar},
    }
}
```

---

## 📈 預期收益

| 指標 | 目前 | 迁移後 | 改進 |
|------|------|--------|------|
| HTTP 重複代碼 | 200+ 行 | 50 行 | -75% |
| 錯誤處理一致性 | 低 | 高 | ↑40% |
| 可維護性 | 中 | 高 | ↑30% |

---

## ⚠️ 風險評估

| 風險 | 級別 | 緩解方案 |
|------|------|----------|
| 修改現有 API 邏輯 | 🔴 高 | 先寫測試，逐個迁移 |
| 性能下降 | 🟡 中 | 基準測試驗證 |
| Cookie/認証 失效 | 🔴 高 | 複雜認証暫時保留 |

---

## 下一步

**需要用戶決策**：

1. **專注快速勝利** - 只迁移簡單的 JSON API（30分鐘）
2. **完整迁移** - 包括 HTML 解析和複雜認証（3-4小時）
3. **漸進式迁移** - 按優先級分階段完成

建議：**先做第1步 + 第2步**，然後根據需要決定是否繼續。

---

## 文件清單

### 需要檢查的文件
```
service/av/search.go
service/av/sync.go  
service/nccc/download.go
service/crawler/function.go
service/screenshot/screenshot.go
service/xcity/request.go
```

### 暫時保留的文件
```
service/nekomaid/pixiv/pixiv.go
service/nekomaid/nico/nico.go
service/auth/firebase_token.go
service/discord/index.go
service/sns/meta.go
```

---

**報告日期**: 2026-06-28  
**狀態**: 等待用戶決策
