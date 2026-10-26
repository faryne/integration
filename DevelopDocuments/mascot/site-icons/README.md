# 三姊妹網站 icon

以 `footer-sd/masters/` 中的三位女僕 SD 圖為角色參考，各自製作頭肩肖像，供三站 header 使用。

| 網站 | 識別重點 | 輸出 |
| --- | --- | --- |
| faryne.dev | 銀色中短髮、亮紫眼、黑白女僕裝 | `faryne-icon.webp` |
| neko.maid.tw | 貓耳、呆毛、琥珀眼、粉白女僕裝 | `nekomaid-icon.webp` |
| galgame.tv | 海豚髮飾、藍色側馬尾、珊瑚粉眼 | `galgame-icon.webp` |

- `masters/`：原始 1254 × 1254 PNG。
- `exports/`：網站使用的 256 × 256 WebP。
- 上傳目的地：`s3://$S3_BUCKET/mascot_assets/site-icons/`，對外網址為 `https://cdn.faryne.dev/mascot_assets/site-icons/`。
- 同批上傳的 footer SD 輸出在 `../footer-sd/exports/`，對外網址為 `https://cdn.faryne.dev/mascot_assets/footer-sd/`。
- 於 repo 根目錄執行 `bash scripts/upload-mascot-assets.sh`。腳本僅讀取 `.env` 的 S3 欄位，逐檔上傳並以 `head-object` 驗證。
