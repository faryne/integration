# faryne.dev footer SD 素材草稿

四張獨立透明底 SD 圖的原稿朝右。Footer 顯示時水平鏡像為朝左，由左至右排列：大姐 faryne.dev → 二姐 neko.maid.tw → 三姐 galgame.tv → 梭梭。大姐帶頭，梭梭落後半步追趕。

## 素材

| 角色 | 網站用 512px PNG | 角色特徵 |
| --- | --- | --- |
| 大姐 | `static_site/public/mascots/footer-sd/faryne-eldest-sd.png` | 銀色中短髮、紫眼、黑白女僕裝、無貼紙 MBP |
| 二姐 | `static_site/public/mascots/footer-sd/neko-second-sd.png` | 貓耳與呆毛、粉白女僕裝、文件夾、無尾巴 |
| 三姐 | `static_site/public/mascots/footer-sd/galgame-third-sd.png` | 深藍側馬尾、珊瑚粉眼、海豚髮飾與圍裙刺繡、耳機、粉藍白條紋膝上襪 |
| 梭梭 | `static_site/public/mascots/footer-sd/suosuo-youngest-sd.png` | 紫藍長髮、金眼、齒輪髮飾、黑金蒸汽龐克洋裝、發光絲線 |

`masters/` 保留 ImageGen 原始透明 PNG。網站用圖經透明邊緣裁切後置入 512×512 透明畫布，四張共約 844 KB。[preview.html](preview.html) 顯示桌面與手機排列；實際版面放在 `SiteFooter`，桌面版位於站名下方、行動版位於站名右側，四張圖分別連向對應網站。

## 生成依據

- 大姐：`DevelopDocuments/mascot/maid-turnaround.png`
- 二姐：`DevelopDocuments/mascot/nekomaid-maid-turnaround-v2.png`
- 三姐：`DevelopDocuments/mascot/galgame-maid-turnaround.png`
- 梭梭：`DevelopDocuments/storyteller/看板娘設定/suosuo-character-sheet-nocturne.png`

四張均以角色三視為身份與服裝參考，並統一要求 2.5 頭身、全身、右向步態、透明背景、清楚外輪廓與 256px 仍可辨識的細節。二姐、三姐、梭梭的生成另以大姐 SD 圖作畫風參考；梭梭保留原有服裝。三姐髮飾經局部修正為單一海豚。
