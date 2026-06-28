# Go 代码优化实施指南

## 快速开始

本文档提供了每个优化方案的详细实施步骤。

---

## 1. 错误处理助手 (优先级: 高)

### 实施步骤

#### Step 1: 创建 `service/helper/error.go`

```go
package helper

import (
    "errors"
    "faryne.dev/service/log"
)

// LogAndContinue 记录错误并返回 true（表示发生错误）
// 适用于在循环中需要继续处理的场景
func LogAndContinue(err error, msg string) bool {
    if err != nil {
        log.Logger().Error(msg + ": " + err.Error())
        return true
    }
    return false
}

// LogAndReturn 记录错误并返回
// 适用于需要传播错误的场景
func LogAndReturn(err error, msg string) error {
    if err != nil {
        log.Logger().Error(msg + ": " + err.Error())
    }
    return err
}

// MustHandle 如果错误发生则 panic（用于关键初始化）
// 适用于启动时的必要初始化
func MustHandle(err error, msg string) {
    if err != nil {
        log.Logger().Panic(msg + ": " + err.Error())
    }
}

// Join 合并多个错误
func Join(errs ...error) error {
    return errors.Join(errs...)
}

// IsNil 检查错误是否为 nil（用于链式调用）
func IsNil(err error) bool {
    return err == nil
}
```

#### Step 2: 迁移现有代码

**示例 1**: `service/twse/etf.go` (第 240-250 行)

```go
// 之前
codeLists, err := repoCode.GetByMarket(marketType)
if err != nil {
    fmt.Println("err: ", err)
    return
}

// 之后
codeLists, err := repoCode.GetByMarket(marketType)
if err := helper.LogAndReturn(err, "Failed to get code lists"); err != nil {
    return err
}
```

**示例 2**: 循环中的错误处理

```go
// 之前
for _, v := range codeLists {
    tickers, err := getETFTicker(v.Code, d)
    if err != nil {
        fmt.Println("err: ", err)
        continue
    }
}

// 之后
for _, v := range codeLists {
    tickers, err := getETFTicker(v.Code, d)
    if helper.LogAndContinue(err, "Failed to get ticker for "+v.Code) {
        continue
    }
}
```

#### Step 3: 测试验证

```bash
# 运行现有测试确保行为不变
go test ./service/... -v
```

### 迁移清单

- [ ] 创建 `service/helper/error.go`
- [ ] 在 `service/twse/etf.go` 中迁移错误处理
- [ ] 在 `service/av/search.go` 中迁移错误处理
- [ ] 在 `service/nccc/` 中迁移错误处理
- [ ] 更新所有测试
- [ ] 运行全部测试验证

---

## 2. 通用 HTTP 客户端 (优先级: 高)

### 实施步骤

#### Step 1: 创建 `service/client/http.go`

```go
package client

import (
    "encoding/json"
    "io"
    "net/http"
    "net/url"
)

type HTTPClient struct {
    client *http.Client
}

var defaultHTTPClient = NewHTTPClient()

func NewHTTPClient() *HTTPClient {
    return &HTTPClient{
        client: &http.Client{},
    }
}

func DefaultHTTPClient() *HTTPClient {
    return defaultHTTPClient
}

// DoRequest 发送已构建的 HTTP 请求并解析响应
// 提供最大的灵活性，支持自定义超时、Cookie、中间件等
func (h *HTTPClient) DoRequest[T any](req *http.Request) (*T, error) {
    resp, err := h.client.Do(req)
    if err != nil {
        return nil, err
    }
    defer resp.Body.Close()
    
    content, err := io.ReadAll(resp.Body)
    if err != nil {
        return nil, err
    }
    
    var result T
    if err := json.Unmarshal(content, &result); err != nil {
        return nil, err
    }
    return &result, nil
}

// Do 便捷方法：发送简单的 HTTP 请求并解析响应
func (h *HTTPClient) Do[T any](
    method string,
    uri string,
    query url.Values,
    body io.Reader,
) (*T, error) {
    u, err := url.Parse(uri)
    if err != nil {
        return nil, err
    }
    
    if query != nil {
        u.RawQuery = query.Encode()
    }
    
    req, err := http.NewRequest(method, u.String(), body)
    if err != nil {
        return nil, err
    }
    
    return h.DoRequest[T](req)
}

// DoWithHeaders 便捷方法：支持自定义请求头
func (h *HTTPClient) DoWithHeaders[T any](
    method string,
    uri string,
    headers map[string]string,
    query url.Values,
    body io.Reader,
) (*T, error) {
    u, err := url.Parse(uri)
    if err != nil {
        return nil, err
    }
    
    if query != nil {
        u.RawQuery = query.Encode()
    }
    
    req, err := http.NewRequest(method, u.String(), body)
    if err != nil {
        return nil, err
    }
    
    for k, v := range headers {
        req.Header.Set(k, v)
    }
    
    return h.DoRequest[T](req)
}
```

#### Step 2: 在服务中使用

**示例** - 在 `service/twse/etf.go` 中:

```go
// 之前
func getETFTicker(code string, date string) ([]ETFTicker, error) {
    uri := fmt.Sprintf("https://api.twse.gov.tw/api/camsrch/?json=1&query_month=%s&firstin=1&pagesize=5000", date)
    
    req, err := http.NewRequest(http.MethodGet, uri, nil)
    if err != nil {
        return nil, err
    }
    
    resp, err := http.DefaultClient.Do(req)
    if err != nil {
        return nil, err
    }
    defer resp.Body.Close()
    
    content, err := io.ReadAll(resp.Body)
    if err != nil {
        return nil, err
    }
    
    var result struct {
        Data []ETFTicker
    }
    if err := json.Unmarshal(content, &result); err != nil {
        return nil, err
    }
    
    return result.Data, nil
}

// 之后
func getETFTicker(code string, date string) ([]ETFTicker, error) {
    result, err := client.DefaultHTTPClient().Do[struct {
        Data []ETFTicker
    }](
        http.MethodGet,
        fmt.Sprintf("https://api.twse.gov.tw/api/camsrch/?json=1&query_month=%s&firstin=1&pagesize=5000", date),
        nil,
        nil,
    )
    
    if err != nil {
        return nil, err
    }
    
    return result.Data, nil
}
```

#### Step 3: 测试验证

```bash
# 创建单元测试
# 验证 HTTP 请求被正确发送
# 验证响应被正确解析
go test ./service/client -v
```

### 迁移清单

- [ ] 创建 `service/client/http.go`
- [ ] 在 `service/twse/etf.go` 中迁移 HTTP 请求
- [ ] 在 `service/dmm/client.go` 中迁移
- [ ] 在 `service/nccc/search.go` 中迁移
- [ ] 在其他服务中迁移
- [ ] 运行全部测试验证

---

## 3. 参数绑定助手 (优先级: 高)

### 实施步骤

#### Step 1: 创建 `controller/helper/binding.go`

```go
package helper

import (
    "faryne.dev/service/output"
    "github.com/gofiber/fiber/v3"
)

// BindQuery 绑定查询参数
func BindQuery[T any](ctx fiber.Ctx, req *T) error {
    if err := ctx.Bind().Query(req); err != nil {
        return output.BadRequest(err)
    }
    return nil
}

// BindJSON 绑定 JSON 请求体
func BindJSON[T any](ctx fiber.Ctx, req *T) error {
    if err := ctx.Bind().JSON(req); err != nil {
        return output.BadRequest(err)
    }
    return nil
}

// BindForm 绑定表单数据
func BindForm[T any](ctx fiber.Ctx, req *T) error {
    if err := ctx.Bind().Form(req); err != nil {
        return output.BadRequest(err)
    }
    return nil
}

// BindParams 绑定路径参数
func BindParams[T any](ctx fiber.Ctx, req *T) error {
    if err := ctx.Bind().URI(req); err != nil {
        return output.BadRequest(err)
    }
    return nil
}
```

#### Step 2: 在控制器中使用

**示例** - 在 `controller/opendata/rate.go` 中:

```go
// 之前
func Rate(ctx fiber.Ctx) error {
    var req ratesEntity.RateRequest
    if err := ctx.Bind().Query(&req); err != nil {
        return output.BadRequest(err)
    }
    
    rates, err := rateSvc.GetRates(ctx.Context(), req.Currencies)
    if err != nil {
        return output.InternalError(err)
    }
    
    return ctx.JSON(output.Success(rates))
}

// 之后
func Rate(ctx fiber.Ctx) error {
    var req ratesEntity.RateRequest
    if err := helper.BindQuery(ctx, &req); err != nil {
        return err
    }
    
    rates, err := rateSvc.GetRates(ctx.Context(), req.Currencies)
    if err != nil {
        return output.InternalError(err)
    }
    
    return ctx.JSON(output.Success(rates))
}
```

### 迁移清单

- [ ] 创建 `controller/helper/binding.go`
- [ ] 在所有控制器文件中迁移参数绑定
- [ ] 运行全部 API 测试验证

---

## 4. 泛型连接池 (优先级: 中)

### 实施步骤

#### Step 1: 创建 `service/client/pool.go`

*(参考 README.md 中的完整代码)*

#### Step 2: 重构 MySQL 连接管理

**文件**: `service/client/mysql.go`

```go
// 之前
var mysqlConnections = make(map[enum.DBName]*gorm.DB)

func GetDB(name enum.DBName) *gorm.DB {
    return mysqlConnections[name]
}

func InitMySql(name enum.DBName, dsn string) error {
    db, err := gorm.Open(mysql.Open(dsn), &gorm.Config{})
    if err != nil {
        return err
    }
    mysqlConnections[name] = db
    return nil
}

func CloseMySqlConnections() error {
    var err error
    for _, db := range mysqlConnections {
        if sqlDB, dbErr := db.DB(); dbErr == nil {
            if closeErr := sqlDB.Close(); closeErr != nil {
                err = errors.Join(err, closeErr)
            }
        }
    }
    return err
}

// 之后
var mysqlPool = NewConnectionPool[enum.DBName, *gorm.DB]()

func GetDB(name enum.DBName) *gorm.DB {
    db, _ := mysqlPool.Get(name)
    return db
}

func InitMySql(name enum.DBName, dsn string) error {
    db, err := gorm.Open(mysql.Open(dsn), &gorm.Config{})
    if err != nil {
        return err
    }
    return mysqlPool.Set(name, db)
}

func CloseMySqlConnections() error {
    return mysqlPool.CloseAll(func(db *gorm.DB) error {
        sqlDB, err := db.DB()
        if err != nil {
            return err
        }
        return sqlDB.Close()
    })
}
```

#### Step 3: 类似迁移 Redis 和 Elasticsearch

**注意**: 确保测试覆盖所有连接场景

### 迁移清单

- [ ] 创建 `service/client/pool.go`
- [ ] 重构 `service/client/mysql.go`
- [ ] 重构 `service/client/redis.go`
- [ ] 重构 `service/client/elasticsearch.go`
- [ ] 运行连接相关的集成测试

---

## 5. 查询构建器 (优先级: 中)

### 实施步骤

#### Step 1: 创建 `service/search/builder.go`

*(参考 README.md 中的完整代码)*

#### Step 2: 在搜索服务中使用

**示例** - 在 `service/av/search.go` 中:

```go
// 之前
func SearchVideos(title string, date string, pageSize int, offset int64) ([]Video, int64, error) {
    var q = map[string]any{
        "size": pageSize,
        "from": offset,
        "sort": map[string]any{
            "updated_time": map[string]any{"order": "desc"},
        },
    }
    
    // 条件添加查询
    if title != "" {
        if _, exists := q["query"]; !exists {
            q["query"] = map[string]any{"bool": map[string]any{}}
        }
        // ... 复杂的查询构建
    }
    
    // 更多条件...
}

// 之后
func SearchVideos(title string, date string, pageSize int, offset int64) ([]Video, int64, error) {
    qb := search.NewQueryBuilder(pageSize, offset).
        WithSort(map[string]any{
            "updated_time": map[string]any{"order": "desc"},
        })
    
    if title != "" {
        qb.AddMustFilter(map[string]any{
            "match": map[string]any{"title": title},
        })
    }
    
    q := qb.Build()
    // ... 继续搜索逻辑
}
```

### 迁移清单

- [ ] 创建 `service/search/builder.go`
- [ ] 在 `service/av/search.go` 中使用
- [ ] 在 `service/nekomaid/search.go` 中使用
- [ ] 在 `service/nccc/search.go` 中使用
- [ ] 运行搜索相关的测试

---

## 6. 批量处理助手 (优先级: 中)

### 实施步骤

#### Step 1: 创建 `service/helper/batch.go`

*(参考 README.md 中的完整代码)*

#### Step 2: 在服务中使用

**示例** - 在 `service/twse/etf.go` 中:

```go
// 之前
for _, code := range codeLists {
    ticker, err := getETFTicker(code.Code, date)
    if err != nil {
        log.Logger().Error("Failed to get ticker: " + err.Error())
        continue
    }
    
    if err := repoTicker.UpdateETFTickerBatch(ticker); err != nil {
        log.Logger().Error("Failed to update ticker: " + err.Error())
        continue
    }
}

// 之后
processor := helper.NewBatchProcessor[CodeList, Ticker]()
result := processor.ProcessWithPersist(
    codeLists,
    func(code CodeList) (Ticker, error) {
        return getETFTicker(code.Code, date)
    },
    func(ticker Ticker) error {
        return repoTicker.UpdateETFTickerBatch(ticker)
    },
)

log.Logger().Info(
    "Batch processing completed",
    zap.Int("successful", len(result.Successful)),
    zap.Int("failed", len(result.Failed)),
)
```

### 迁移清单

- [ ] 创建 `service/helper/batch.go`
- [ ] 在 `service/twse/etf.go` 中使用
- [ ] 在其他批量处理的地方使用
- [ ] 运行相关的测试

---

## 测试策略

### 单元测试示例

```go
// service/helper/error_test.go
package helper

import (
    "errors"
    "testing"
)

func TestLogAndContinue(t *testing.T) {
    // 测试无错误情况
    if LogAndContinue(nil, "test") {
        t.Error("expected false for nil error")
    }
    
    // 测试有错误情况
    err := errors.New("test error")
    if !LogAndContinue(err, "test") {
        t.Error("expected true for non-nil error")
    }
}

func TestLogAndReturn(t *testing.T) {
    err := errors.New("test error")
    result := LogAndReturn(err, "test")
    if result != err {
        t.Errorf("expected %v, got %v", err, result)
    }
}
```

### 集成测试

确保迁移后的代码与原代码行为完全一致：

```bash
# 运行全部测试
go test ./... -v -race

# 运行特定模块的测试
go test ./service/twse -v

# 运行覆盖率检查
go test ./... -cover
```

---

## 验收标准

对每个优化方案，确保满足以下标准：

- [ ] 新代码通过所有单元测试
- [ ] 集成测试通过（与原代码行为一致）
- [ ] 代码覆盖率不低于原有水平
- [ ] 无新的 lint 错误
- [ ] 文档已更新
- [ ] 代码审查通过

---

## 常见问题 (FAQ)

### Q: 这些优化会改变现有的行为吗？

A: 不会。这些优化是纯重构，保持现有的 API 和行为完全不变。

### Q: 能否一次性实施所有优化？

A: 不建议。建议按照优先级逐步实施，这样更容易测试和回滚。

### Q: 如何处理向后兼容性？

A: 由于这些是内部服务代码，向后兼容性不是问题。但建议在迁移时保留原有函数一段时间，标记为 `deprecated`。

### Q: 泛型会影响性能吗？

A: Go 的泛型在编译时展开，不会有运行时开销。实际上由于减少了接口{}的使用，可能会有性能提升。

---

**更新日期**: 2026-06-28
**版本**: v1.0
