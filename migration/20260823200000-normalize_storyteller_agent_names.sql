-- +migrate Up
-- Agent 名稱同時是 AI 助理裡 /<名稱> slash 指令要逐字（不分大小寫）比對的目標字串
-- （見 service/storyteller/storyteller.go 的 normalizeAgentName，2026-08-23 起新增/
-- 編輯時會把內部連續空白收斂成單一空格）。這支 migration 是一次性把既有資料補齊同一
-- 個規則，不然「看起來一樣」但內部空白數量不同的舊名稱，會讓使用者打指令永遠對不上。
--
-- MySQL 5.7 沒有 REGEXP_REPLACE，改用巢狀 REPLACE 反覆把兩個空格收斂成一個：每收斂一次，
-- 連續空格的最長長度就減半，10 層巢狀足以處理到 2^10 個連續空格，遠超過任何真實情境會
-- 打出來的數量。只處理半形空白（0x20）；理論上 name 欄位是單行文字輸入，正常情況下不會
-- 混進 tab／換行這類其他空白字元。
UPDATE `storyteller_agents`
SET `name` = TRIM(
    REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(
        `name`, '  ', ' '), '  ', ' '), '  ', ' '), '  ', ' '), '  ', ' '),
        '  ', ' '), '  ', ' '), '  ', ' '), '  ', ' '), '  ', ' ')
)
WHERE `name` != TRIM(
    REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(
        `name`, '  ', ' '), '  ', ' '), '  ', ' '), '  ', ' '), '  ', ' '),
        '  ', ' '), '  ', ' '), '  ', ' '), '  ', ' '), '  ', ' ')
);

-- +migrate Down
-- 正規化是單向收斂（拿掉多餘空格），原始的空格數量沒有保留，沒有對應的還原動作。
