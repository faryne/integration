# 四站 Loading 看板娘動態圖草稿

[preview.html](preview.html) 以四站現有 Loading 頁為方向排版。三姊妹的透明 GIF 由各自主服三視與既有 SD 圖生成四格動作，再輸出成 320 × 320 的循環動畫；梭梭暫沿用已上線的 Loading GIF。

| 站點 | 動作 | 循環時間 | 草稿 |
| --- | --- | --- | --- |
| faryne.dev | 大姐抱著無貼紙 MBP，優雅地換腳步行 | 1.12 秒 | [faryne-walk-draft.gif](exports/faryne-walk-draft.gif) |
| neko.maid.tw | 二姐抱穩文件，貓咪般的小碎步與輕微彈跳 | 0.60 秒 | [nekomaid-trot-draft.gif](exports/nekomaid-trot-draft.gif) |
| galgame.tv | 三姐擺臂奔跑，側馬尾與圍裙隨動作飄起 | 0.48 秒 | [galgame-run-draft.gif](exports/galgame-run-draft.gif) |
| steamloom.works | 梭梭沿用現有 Loading GIF，這次不重新繪製 | 既有設定 | `suosuo-loading-thinking-v1-256.gif` |

`masters/` 保留生成的 2 × 2 四格原稿，`exports/` 放 GIF 與各自的靜態首幀。靜態首幀可用於使用者偏好減少動態效果的情境。三姐的襪口以上保留大腿自然膚色，條紋只出現在膝上襪。

目前僅供確認動作、節奏與版面；尚未修改 `LoadingFallback` 或上傳新圖到 S3。
