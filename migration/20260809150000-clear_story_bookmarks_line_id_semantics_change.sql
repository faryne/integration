-- +migrate Up
-- line_id 的語意從「原始行號」改成「分組後 block 的起始行號」（見
-- service/storyteller/storyteller.go 的 groupStoryLinesByBlockKind 說明），書籤定位單位
-- 從「一行」變成「一個渲染分組（一般段落/標題各自一組，引用/清單/表格等合併成一組）」。
-- 這是刻意的破壞性變更：不對既有資料做換算遷移，直接清空既有文字書籤，讓使用者用新語意
-- 重新標——只清 story_version_id 不是 NULL 的文字書籤，圖片書籤（story_version_id 是
-- NULL，line_id 存頁面 id）不受這次語意變更影響，不動。
DELETE FROM `storyteller_story_bookmarks` WHERE `story_version_id` IS NOT NULL;

-- +migrate Down
-- 資料已經清空，沒有東西可以復原；down 這裡沒有對應動作。
