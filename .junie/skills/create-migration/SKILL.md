---
name: Create Migration
description: Create Migration 建立新的 Migration 檔案
tags:
  - database
  - migration
---

# Create Migration 建立新的 Migration
你會根據使用者的需求建立後並執行 migration 檔案的 up 與 down。

注意：你的操作必須在使用確認並同意後才能繼續進行。

你的所有操作都基於本專案根目錄下的 `migration` 的設定與 migration 檔案，
且可執行環境皆僅限於 `migration/config.yaml` 中所定義的 `localhost` 環境。

另外，若使用者有明示使用的資料庫類型及版本時，以使用者所提示的為主，否則預設使用 `MySQL 5.7x`。

## Usage 使用規則

### 檢查 sql-migrate

---

確認 sql-migrate 是否安裝
```shell
sql-migrate -version
```

若是回傳值為非 0 的狀態碼代表未安裝，請使用以下指令安裝
```shell
go install github.com/rubenv/sql-migrate@latest
```

### 收集使用者需求並產生檔案

---
使用者需要提供資料表操作的相關提示詞，例如：
```text
我想要建立 user 

我要變更 user 中 password 的欄位長度
```
當收到使用者的需求時，你必須與使用者確認用途或是其他細節以整理出所需要執行的 up 與 down 操作。
而且每個欄位都必須加上相對應的中文註解。

整理出 up 時所需執行的 sql 後，你會根據以下 pattern 產生 migration 並執行 `sql-migrate new -env localhost -config ./migration/config.yml [migrationName]` 的操作：
- 建立 Table： `create_[tableName]`
- 修改 Table： 以 `alter_[tableName]` 開頭，並使用以下的 pattern 附加字串：
    1. 變更欄位類型：`modify_[columnName]`
    2. 新增欄位：`add_[columnName]`
    3. 刪除欄位：`drop_[columnName]`
- 刪除 Table： `drop_[tableName]`

然後將 up 與 down 所需的 sql 依序填入，如範例：
```sql
-- +migrate Up
CREATE TABLE .... ;

-- +migrate Down
DROP TABLE .... ;
```

### 讓使用者確認並執行
產生後，請先讓使用者確認 up 與 down 的 sql 內容，若使用者同意後則可執行：
```shell
sql-migrate up -env localhost -config ./migration/config.yml
```

若是使用者覺得還有需要修改時，則需要執行：
```shell
sql-migrate down -env localhost -config ./migration/config.yml
```

並回到 `收集使用者需求並產生檔案` 步驟，使用該步驟一開始產生的檔案重新整理出 up 與 down 的 sql 後重新執行本步驟。

若是使用者對此操作不滿意想完全撤銷修改，則：
- 執行 `sql-migrate down -env localhost -config ./migration/config.yaml` （注意：只能撤銷最後一次的 migration） 
- 刪除已經產生的 migration 檔案




