# 四站 ErrorPage 看板娘圖示提案

目前 `static_site/src/pages/ErrorPage.tsx` 對 SteamLoom 已使用梭梭錯誤姿勢圖；其餘三站共用六張舊的銀髮貓耳女僕圖，與新定案的三姊妹造型不符。

本稿先確認圖像與 404 頁排版，尚未修改 `ErrorPage.tsx` 或上傳新圖到 S3。預覽見 [preview.html](preview.html)。

| 網站 | 錯誤狀態動作 | 素材 |
| --- | --- | --- |
| faryne.dev | 大姐看著暫時斷線的無貼紙 MBP，冷靜中稍微 `pon` 一下 | `exports/faryne-error.png` |
| neko.maid.tw | 二姐在文件滑落時接住資料夾，有點慌但仍掌握得住 | `exports/nekomaid-error.png` |
| galgame.tv | 三姐坐下休息，手持低電量圖示；大腿根部露出少量膚色，襪口位於膝蓋稍上方，膝蓋以下為粉藍白條紋 | `exports/galgame-error.png` |
| steamloom.works | 梭梭查看手中的纏結絲線，沿用已上線姿勢圖 | `references/suosuo-error-nocturne-512.png` |

`masters/` 是新生成的透明 PNG 原稿；`exports/` 是適合 ErrorPage 使用的 512 × 512 透明 PNG。梭梭仍沿用 `steamloom_assets/suosuo-error-{appearance}-512.png`，預覽用的 nocturne 版本複本放在 `references/`。

實作時三站圖片預計放到既有共用 bucket 的 `mascot_assets/error-page/`，頁面依站點或巢狀路徑選圖。SteamLoom 的 appearance 切換與現有 CDN 路徑維持原設定。現有六張舊圖在新圖正式切換後才清理。

目前非 SteamLoom 頁面的預設錯誤文案也共用「貓娘女僕」語氣，因此大姐、三姐會與文字不一致。這份預覽的文案只供排版示意；實作前應確認是否一併按站點調整文案。
