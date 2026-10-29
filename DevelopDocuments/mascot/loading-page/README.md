# 四站 Loading 看板娘動態圖

[preview.html](preview.html) 以四站現有 Loading 頁為方向排版。三姊妹的透明 GIF 由各自主服三視與既有 SD 圖生成四格動作，再輸出成 320 × 320 的循環動畫；梭梭暫沿用已上線的 Loading GIF。

| 站點 | 動作 | 循環時間 | 圖片 |
| --- | --- | --- | --- |
| faryne.dev | 大姐抱著無貼紙 MBP，優雅地換腳步行 | 1.12 秒 | [faryne-walk-v1.gif](exports/faryne-walk-v1.gif) |
| neko.maid.tw | 二姐抱穩文件，貓咪般的小碎步與輕微彈跳 | 0.60 秒 | [nekomaid-trot-v1.gif](exports/nekomaid-trot-v1.gif) |
| galgame.tv | 三姐跨步、抬膝與騰空，側馬尾與圍裙隨動作飄起 | 0.48 秒 | [galgame-run-v1.gif](exports/galgame-run-v1.gif) |
| steamloom.works | 梭梭沿用現有 Loading GIF，這次不重新繪製 | 既有設定 | `suosuo-loading-thinking-v1-256.gif` |

`masters/` 保留生成的 2 × 2 四格原稿，以及三姐重畫的抬膝與騰空關鍵影格；`exports/` 放 GIF 與各自的靜態首幀。靜態首幀可用於使用者偏好減少動態效果的情境。三姐的襪口以上保留大腿自然膚色，條紋只出現在膝上襪。

三姊妹 GIF 與靜態首幀上傳到 `s3://$S3_BUCKET/mascot_assets/loading-page/`，網站透過 `https://cdn.faryne.dev/mascot_assets/loading-page/` 讀取。執行 `bash scripts/upload-mascot-assets.sh loading-page` 可單獨上傳並驗證這組圖。
