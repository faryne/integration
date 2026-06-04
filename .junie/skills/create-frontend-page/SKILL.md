---
name: Create Frontend Page
description: Create a new frontend page for the project 建立一個前端頁面
tags: 
  - frontend page
  - create
  - typescript
  - react 
---

# Create Frontend Page 建立前端頁面
根目錄為 `static_site/src`

以下是目錄細部說明：
- `apis`：存放各種 API 的定義和相關邏輯
- `components`：存放可重用的元件（Component）。 `components/common` 資料夾下存放通用元件。
- `data`：寫死的一些固定/靜態資料
- `helpers`：通用方法，輔助頁面用。
- `layouts`：存放頁面布局相關的元件和邏輯
- `pages`：存放各個頁面的元件和邏輯
- `styles`：存放樣式相關的檔案，如 CSS 樣式表和 MUI 主題設定
- `types`：資料型態的宣告

## 注意事項
1. 頁面設計以 MUI 為基礎，不得使用其他元件系統
2. 設計元件（Component）時必須遵循 MUI 的設計指南和最佳實踐，且需同時考慮到通用性
3. 確保頁面的可測試性，並撰寫相對應的測試用例
4. 確保頁面的性能優化，避免不必要的重渲染和資源浪費
5. 若需使用元件，請先查詢 

## 頁面必須要有的內容
1. 麵包屑 BreadCrumb 
2. 網頁標題 Page Title
3. 內容區 Content Area
