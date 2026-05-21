---
name: Create or Modify Model
description: Create or modify a model in the database depends on migration file 根據 migration 內容新增或是變更 model 定義
---

# Create or Modify Model

根據最近一次的 migration 內容或是使用者的要求新增或是變更 model。

model 定義全數放在本專案根目錄下的 `model/entity` 目錄下。會根據使用領域不同再細分子目錄。
使用時請先遍覽該目錄下所有檔案，找出 TableName 方法回傳值與 `migration` 中所操作的資料表相符的進行操作。
若是找不到符合的，則表示該 model 尚未被定義，需要先新增 model 定義。

本專案使用 `gorm`，因此 model 內 struct 或是 repository 中的方法定義必須符合 `gorm` 的規範。

## 新增 model 
新增 model 時，使用以下的範例建立：
```go
type ModelName struct {
	Id int64 `json:"id" gorm:"column:id;primaryKey;autoIncrement" validate:"..."` // 後面要有欄位註解
	// 其他欄位......
	CreatedAt time.Time `json:"created_at"`
	UpdatedAt time.Time `json:"updated_at"`
}

func (s *ModelName) TableName() string {
    return "model_name"
}
```

每個元素的 struct tag 都必須要有 `json`、`gorm`、`validate` 三種 tag。其中 `validate` tag 作為選用，只能填入非 `required` 的驗證條件。
此外 `validate` 部分使用：`github.com/go-playground/validator/v10` 進行操作。

## 新增 model 對應的 DB 操作方法
在 `repository` 目錄中找尋符合條件的 repository ，若是不符合則根據需求建立一個擁有基本方法的 repository，如範例：
```go
type RepositoryModelName struct {
    *repository.Repository[model.ModelName] // 必須 embed 這個方法才能使用上層已經準備好的一些操作方法
}

func NewModelName() *RepositoryModelName {
    repo := repository.NewRepository[model.ModelName](client.GetDB(enum.DBWalolita))
    return &RepositoryModelName{
        Repository: repo,
    }
}
```

## 操作完成後
你無需進行任何 `build` 等操作或檢查以確保是否可用。最多只需要針對產生的檔案進行 `lint` 檢查即可。





