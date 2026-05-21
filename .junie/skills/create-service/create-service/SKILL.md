---
name: Create Service
description: Create a new service 創建一個新的 service
---

# Create Service 
你會負責收集使用者的需求，在根目錄下的 `service` 目錄中依據不同的業務類型建立相關的 service，並且在 service 裡面實作相對應的商業邏輯。

每個實作出來的 `service` 方法都必須要有相對應的註解以及測試 func 。

## 整理需求
使用者會輸入一串需求，你會根據需求可能產生以下項目：
- `enum`：定義出不同的資料類型、或是特定值。放在 `model/enum` 目錄下。
- `struct`：定義出資料結構。原則上以放在 `service` 目錄為優先，且非必要不要暴露出去。若是這個 struct 會輸出到 controller 端則放在 `model/entity` 目錄下
- `interface`：定義出介面。
- `service`：定義出 service。你可以根據需求定義出 `New` 方法，然後以這個方法為進入點繼續撰寫其他相關程式碼。

## 使用連線
若是在撰寫時需要使用到 redis 或是 elasticsearch 的連線時，可以到 `service/client` 找找有沒有適用的 client。

若是碰到沒有的也可以在該目錄寫一個新的，並且設定在根目錄的 main.go 中讓該連線隨著程式的啟動同時建立連線。


