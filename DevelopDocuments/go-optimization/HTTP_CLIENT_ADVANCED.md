# HTTP 客户端 - 高级用法指南

本文档详细讨论通用 HTTP 客户端的高级用法，特别是 `DoRequest` 方法。

---

## 三层 API 设计

通用 HTTP 客户端提供三个层级的 API，满足不同的使用场景：

```
第一层: DoRequest[T](*http.Request) -> 最灵活，支持所有 HTTP 特性
    ↑
    └─ 第二层: DoWithHeaders[T](method, uri, headers, query, body) -> 便捷，支持请求头
        ↑
        └─ 第三层: Do[T](method, uri, query, body) -> 最简洁，快速开发
```

### 设计原则

- **第三层 (Do)**: 用于 90% 的简单场景
- **第二层 (DoWithHeaders)**: 用于需要自定义请求头的场景
- **第一层 (DoRequest)**: 用于需要完全控制的复杂场景

---

## DoRequest 方法详解

### 签名

```go
func (h *HTTPClient) DoRequest[T any](req *http.Request) (*T, error)
```

### 优势

#### 1. 自定义超时控制

```go
// 场景：某个 API 响应慢，需要更长的超时时间
func fetchSlowAPI(url string) ([]Data, error) {
    req, err := http.NewRequest(http.MethodGet, url, nil)
    if err != nil {
        return nil, err
    }
    
    // 创建自定义超时的客户端
    client := &http.Client{
        Timeout: 30 * time.Second,  // 默认可能是 5 秒
    }
    
    // ... 但这样需要管理多个客户端
    // 更好的做法：在请求层面处理
}
```

#### 2. 完整的 Cookie 管理

```go
// 场景：需要维护会话状态
func authenticatedRequest(url string, sessionID string) (Response, error) {
    req, err := http.NewRequest(http.MethodGet, url, nil)
    if err != nil {
        return nil, err
    }
    
    // 添加单个 Cookie
    req.AddCookie(&http.Cookie{
        Name:     "session_id",
        Value:    sessionID,
        Path:     "/",
        HttpOnly: true,
        Secure:   true,
    })
    
    return client.DefaultHTTPClient().DoRequest[Response](req)
}
```

#### 3. 自定义请求头组合

```go
// 场景：复杂的 API 认证需求
func authorizedRequest(url string, token string) (Response, error) {
    req, err := http.NewRequest(http.MethodPost, url, requestBody)
    if err != nil {
        return nil, err
    }
    
    // 标准请求头
    req.Header.Set("Content-Type", "application/json")
    req.Header.Set("Accept", "application/json")
    
    // 认证请求头
    req.Header.Set("Authorization", "Bearer "+token)
    
    // 自定义请求头
    req.Header.Set("X-API-Version", "2")
    req.Header.Set("X-Request-ID", uuid.New().String())
    
    // 跟踪请求头
    req.Header.Set("User-Agent", "MyApp/1.0")
    
    return client.DefaultHTTPClient().DoRequest[Response](req)
}
```

#### 4. 条件性请求头

```go
// 场景：基于运行时条件添加请求头
func conditionalRequest(url string, version string) (Response, error) {
    req, err := http.NewRequest(http.MethodGet, url, nil)
    if err != nil {
        return nil, err
    }
    
    // 根据条件添加不同的请求头
    if version != "" {
        req.Header.Set("Accept", "application/vnd.api+json;version="+version)
    }
    
    if os.Getenv("DEBUG") == "true" {
        req.Header.Set("X-Debug", "true")
    }
    
    return client.DefaultHTTPClient().DoRequest[Response](req)
}
```

#### 5. 查询参数的高级处理

```go
// 场景：动态构建复杂的查询参数
func searchWithFilters(baseURL string, filters map[string][]string) (Results, error) {
    req, err := http.NewRequest(http.MethodGet, baseURL, nil)
    if err != nil {
        return nil, err
    }
    
    // 动态添加查询参数
    q := req.URL.Query()
    for key, values := range filters {
        for _, value := range values {
            q.Add(key, value)
        }
    }
    req.URL.RawQuery = q.Encode()
    
    // 添加分页参数
    pageQuery := req.URL.Query()
    pageQuery.Set("page", "1")
    pageQuery.Set("limit", "50")
    req.URL.RawQuery = pageQuery.Encode()
    
    return client.DefaultHTTPClient().DoRequest[Results](req)
}
```

#### 6. 请求体的细粒度控制

```go
// 场景：需要流式上传或特殊的编码
func uploadWithProgress(url string, filePath string) (Response, error) {
    file, err := os.Open(filePath)
    if err != nil {
        return nil, err
    }
    defer file.Close()
    
    fileInfo, err := file.Stat()
    if err != nil {
        return nil, err
    }
    
    // 获取文件大小
    req, err := http.NewRequest(http.MethodPost, url, file)
    if err != nil {
        return nil, err
    }
    
    // 设置正确的 Content-Length
    req.ContentLength = fileInfo.Size()
    req.Header.Set("Content-Type", "application/octet-stream")
    
    return client.DefaultHTTPClient().DoRequest[Response](req)
}
```

#### 7. 上下文传播

```go
// 场景：需要传播请求的截止时间
func contextAwareRequest(ctx context.Context, url string) (Response, error) {
    req, err := http.NewRequestWithContext(ctx, http.MethodGet, url, nil)
    if err != nil {
        return nil, err
    }
    
    // 请求将尊重 ctx 的截止时间和取消信号
    // 如果 ctx 被取消，请求会立即返回
    return client.DefaultHTTPClient().DoRequest[Response](req)
}
```

---

## 实际使用场景对比

### 场景 1: NCCC API（需要自定义超时）

```go
// 使用 Do（不支持超时定制）
func FetchNCCCSimple(key string) (map[string]any, error) {
    return client.DefaultHTTPClient().Do[map[string]any](
        http.MethodGet,
        "https://api.nccc.gov.tw/dataset/"+key,
        nil,
        nil,
    )
    // 问题：如果 API 响应慢，无法增加超时
}

// 使用 DoRequest（完整控制）
func FetchNCCCWithTimeout(key string, timeout time.Duration) (map[string]any, error) {
    ctx, cancel := context.WithTimeout(context.Background(), timeout)
    defer cancel()
    
    req, err := http.NewRequestWithContext(
        ctx,
        http.MethodGet,
        "https://api.nccc.gov.tw/dataset/"+key,
        nil,
    )
    if err != nil {
        return nil, err
    }
    
    return client.DefaultHTTPClient().DoRequest[map[string]any](req)
}
```

### 场景 2: YouTube API（需要 API Key）

```go
// 使用 DoWithHeaders
func SearchYouTube(query string, apiKey string) ([]Video, error) {
    return client.DefaultHTTPClient().DoWithHeaders[struct {
        Items []Video
    }](
        http.MethodGet,
        "https://www.googleapis.com/youtube/v3/search",
        map[string]string{
            "Authorization": "Bearer " + apiKey,
        },
        url.Values{"q": {query}},
        nil,
    )
}

// 使用 DoRequest（更灵活的认证）
func SearchYouTubeAdvanced(query string, credentials *YouTubeCredentials) ([]Video, error) {
    req, err := http.NewRequest(
        http.MethodGet,
        "https://www.googleapis.com/youtube/v3/search",
        nil,
    )
    if err != nil {
        return nil, err
    }
    
    q := req.URL.Query()
    q.Add("q", query)
    q.Add("part", "snippet")
    req.URL.RawQuery = q.Encode()
    
    // 支持多种认证方式
    if credentials.Bearer != "" {
        req.Header.Set("Authorization", "Bearer "+credentials.Bearer)
    } else if credentials.APIKey != "" {
        q := req.URL.Query()
        q.Set("key", credentials.APIKey)
        req.URL.RawQuery = q.Encode()
    }
    
    req.Header.Set("Accept", "application/json")
    
    return client.DefaultHTTPClient().DoRequest[struct {
        Items []Video
    }](req)
}
```

### 场景 3: AV 数据库搜索（需要复杂的过滤条件）

```go
// 使用 Do（适合简单情况）
func SearchSimple(title string) ([]Video, error) {
    return client.DefaultHTTPClient().Do[[]Video](
        http.MethodGet,
        "https://api.av.db/search?title="+url.QueryEscape(title),
        nil,
        nil,
    )
}

// 使用 DoRequest（处理复杂的过滤逻辑）
func SearchAdvanced(filters VideoFilters) ([]Video, error) {
    req, err := http.NewRequest(http.MethodGet, "https://api.av.db/search", nil)
    if err != nil {
        return nil, err
    }
    
    q := req.URL.Query()
    
    // 添加基本过滤
    if filters.Title != "" {
        q.Set("title", filters.Title)
    }
    if filters.Actress != "" {
        q.Set("actress", filters.Actress)
    }
    
    // 添加日期范围
    if !filters.DateFrom.IsZero() {
        q.Set("date_from", filters.DateFrom.Format(time.DateOnly))
    }
    if !filters.DateTo.IsZero() {
        q.Set("date_to", filters.DateTo.Format(time.DateOnly))
    }
    
    // 添加分页和排序
    q.Set("page", strconv.Itoa(filters.Page))
    q.Set("limit", strconv.Itoa(filters.PageSize))
    q.Set("sort", filters.SortBy)
    
    // 添加高级过滤
    for key, values := range filters.Tags {
        for _, value := range values {
            q.Add("tags", value)
        }
    }
    
    req.URL.RawQuery = q.Encode()
    
    // 添加认证
    req.Header.Set("Authorization", "Bearer "+filters.AuthToken)
    req.Header.Set("X-Request-ID", uuid.New().String())
    
    return client.DefaultHTTPClient().DoRequest[[]Video](req)
}
```

---

## 选择指南

### 使用 `Do` 的场景

✅ **适合使用**:
```go
// 简单的 GET 请求
result, err := client.DefaultHTTPClient().Do[Data](
    http.MethodGet,
    url,
    nil,
    nil,
)

// 带查询参数的请求
result, err := client.DefaultHTTPClient().Do[Data](
    http.MethodGet,
    url,
    url.Values{"key": {"value"}},
    nil,
)

// 简单的 POST
result, err := client.DefaultHTTPClient().Do[Data](
    http.MethodPost,
    url,
    nil,
    strings.NewReader(`{"key": "value"}`),
)
```

### 使用 `DoWithHeaders` 的场景

✅ **适合使用**:
```go
// 需要认证请求头
result, err := client.DefaultHTTPClient().DoWithHeaders[Data](
    http.MethodGet,
    url,
    map[string]string{
        "Authorization": "Bearer " + token,
        "X-API-Version": "2",
    },
    nil,
    nil,
)

// 需要多个自定义请求头
headers := map[string]string{
    "Content-Type": "application/json",
    "Accept": "application/json",
    "User-Agent": "MyApp/1.0",
}
result, err := client.DefaultHTTPClient().DoWithHeaders[Data](...)
```

### 使用 `DoRequest` 的场景

✅ **需要使用**:
```go
// 需要上下文控制和超时
ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
defer cancel()
req, _ := http.NewRequestWithContext(ctx, http.MethodGet, url, nil)
result, err := client.DefaultHTTPClient().DoRequest[Data](req)

// 需要 Cookie 管理
req, _ := http.NewRequest(http.MethodGet, url, nil)
req.AddCookie(&http.Cookie{Name: "session", Value: "..."})
result, err := client.DefaultHTTPClient().DoRequest[Data](req)

// 需要条件性添加请求头
req, _ := http.NewRequest(http.MethodGet, url, nil)
if isDebug {
    req.Header.Set("X-Debug", "true")
}
result, err := client.DefaultHTTPClient().DoRequest[Data](req)

// 需要复杂的查询参数构建
q := req.URL.Query()
for k, v := range dynamicParams {
    q.Add(k, v)
}
req.URL.RawQuery = q.Encode()
result, err := client.DefaultHTTPClient().DoRequest[Data](req)

// 流式上传/下载
file, _ := os.Open("large-file.dat")
req, _ := http.NewRequest(http.MethodPost, url, file)
req.ContentLength = fileSize
result, err := client.DefaultHTTPClient().DoRequest[Data](req)
```

---

## 最佳实践

### 1. 默认使用最简单的方法

```go
// ✅ 优先选择这个（最清晰）
result, err := client.DefaultHTTPClient().Do[Data](
    http.MethodGet,
    url,
    nil,
    nil,
)

// 只在必要时使用 DoWithHeaders
// 只在必要时使用 DoRequest
```

### 2. 为复杂的请求创建辅助函数

```go
// ✗ 不要在业务代码中直接构建复杂请求
req, _ := http.NewRequest(...)
// ... 20 行的请求构建逻辑 ...
result, _ := client.DefaultHTTPClient().DoRequest[Data](req)

// ✅ 封装为辅助函数
func FetchWithFiltersAndAuth(filters SearchFilters, token string) (Results, error) {
    req, _ := http.NewRequest(http.MethodGet, apiURL, nil)
    // ... 构建逻辑 ...
    return client.DefaultHTTPClient().DoRequest[Results](req)
}
```

### 3. 处理特定的 HTTP 错误

```go
// ✅ 检查 HTTP 状态码
func FetchWithErrorHandling(url string) (Data, error) {
    req, _ := http.NewRequest(http.MethodGet, url, nil)
    
    // DoRequest 只处理网络错误和解析错误
    // HTTP 4xx/5xx 也被视为成功的 JSON 解析
    
    // 如果需要检查状态码，在 DoRequest 前构建 req 时处理
    resp, _ := client.DefaultHTTPClient().client.Do(req)
    if resp.StatusCode != http.StatusOK {
        return nil, fmt.Errorf("HTTP %d", resp.StatusCode)
    }
    // ... 手动处理响应
}
```

### 4. 重用请求对象

```go
// ✅ 如果需要发送多个相同的请求，重用构建逻辑
func createBaseRequest(url string) (*http.Request, error) {
    req, err := http.NewRequest(http.MethodGet, url, nil)
    if err != nil {
        return nil, err
    }
    
    // 通用的配置
    req.Header.Set("User-Agent", "MyApp/1.0")
    req.Header.Set("Accept", "application/json")
    
    return req, nil
}

// 在多个地方使用
req, _ := createBaseRequest(url1)
req.Header.Set("X-Special", "value1")
result1, _ := client.DefaultHTTPClient().DoRequest[Data](req)

req, _ := createBaseRequest(url2)
req.Header.Set("X-Special", "value2")
result2, _ := client.DefaultHTTPClient().DoRequest[Data](req)
```

---

## 总结

| 方法 | 适合场景 | 灵活性 | 代码长度 |
|------|---------|--------|---------|
| `Do` | 简单请求 | 低 | 短 |
| `DoWithHeaders` | 需要请求头 | 中 | 中 |
| `DoRequest` | 复杂请求 | 高 | 长 |

**建议**: 从 `Do` 开始，根据需求逐步升级到 `DoWithHeaders` 或 `DoRequest`。

---

**文档日期**: 2026-06-28  
**版本**: v1.1  
**更新**: 添加了 DoRequest 方法的详细讨论
