---
name: faryne.dev new function skill
description: A skill for creating a new function in this project.  透過收集使用者的需求在此專案中建立相關功能的程式碼
tags:
  - db
  - mysql
  - migration
  - golang
  - typescript
---

# CREATE A NEW FUNCTION 建立一個新功能
這是一個可以在本專案中建立新功能的 skill ，你的任務就是收集使用者的需求，並根據需要建立相應的 migration / golang / typescript 程式碼
- 建立 migration 
- 處理資料應用
- 產生商業邏輯程式碼
- 產生 controller 
- 將 controller

## 建立 sql migration
請呼叫 `create-migration` 這個 SKILL 進行操作

## 建立 migration 後......
此時需要處理 `model` 與 `repository`

本專案使用 `gorm`，因此 model 內 struct 或是 repository 中的方法定義必須符合 `gorm` 的規範。

### 處理 model

需要去尋找 `model` 中的符合條件的 struct，若是沒有的話需要新增，如以下範例：
```go
type ModelName struct {
	Id int64 `json:"id"`
	// 其他欄位......
	CreatedAt time.Time `json:"created_at"`
	UpdatedAt time.Time `json:"updated_at"`
}

func (s *ModelName) TableName() string {
	return "model_name"
}
```

若是有符合的則直接修改 struct 即可

### 處理 repository 
在 `repository` 目錄中找尋符合條件的 repository ，若是不符合則根據需求建立一個擁有基本方法的 repository，如範例：
```go
type RepositoryModelName struct {
    *repository.Repository[model.ModelName]
}

func NewModelName() *RepositoryModelName {
    repo := repository.NewRepository[model.ModelName](client.GetDB(enum.DBWalolita))
    return &RepositoryModelName{
        Repository: repo,
    }
}
```





