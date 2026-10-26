# 四站 ErrorPage 看板娘圖示提案

四站 ErrorPage 已接入對應看板娘圖像與文案。圖像與 404 頁排版預覽見 [preview.html](preview.html)。

| 網站 | 錯誤狀態動作 | 素材 |
| --- | --- | --- |
| faryne.dev | 大姐看著暫時斷線的無貼紙 MBP，冷靜中稍微 `pon` 一下 | `exports/faryne-error.png` |
| neko.maid.tw | 二姐在文件滑落時接住資料夾，有點慌但仍掌握得住 | `exports/nekomaid-error.png` |
| galgame.tv | 三姐沒電後無奈地鴨子座，雙膝向外、兩腳折到身體兩側，一手撐地、一手拿低電量裝置；裙內短黑安全褲、裸露的大腿與兩只高於膝蓋的粉藍白條紋襪分層清楚 | `exports/galgame-error.png` |
| steamloom.works | 梭梭查看手中的纏結絲線，沿用已上線姿勢圖 | `references/suosuo-error-nocturne-512.png` |

`masters/` 是新生成的透明 PNG 原稿；`exports/` 是適合 ErrorPage 使用的 512 × 512 透明 PNG。梭梭仍沿用 `steamloom_assets/suosuo-error-{appearance}-512.png`，預覽用的 nocturne 版本複本放在 `references/`。

三姊妹圖片放在既有共用 bucket 的 `mascot_assets/error-page/`，對外網址為 `https://cdn.faryne.dev/mascot_assets/error-page/`。在 repo 根目錄執行 `bash scripts/upload-mascot-assets.sh error-page` 可單獨上傳這組圖，並逐一驗證 S3 物件。頁面依站點網域或巢狀路徑選圖；SteamLoom 的 appearance 切換與現有 CDN 路徑維持原設定。

預設錯誤文案依站點切換。若呼叫方明確指定 `title` 或 `message`，仍以呼叫方內容為準。
