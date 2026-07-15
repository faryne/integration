-- +migrate Up
-- ROCFullDateToAD 舊版沒有年份合理性檢查，遇到來源資料亂碼時（例如
-- ex_date token 被誤解析成 4 位數）會算出如西元 3817 年這種不合理日期，
-- 但仍視為解析成功寫入 DB，產生跟正確資料重複的髒紀錄。
-- 程式端已在 service/helper/date.go 補上防呆，這裡清掉既有的髒資料。
DELETE FROM `etf_shares`
WHERE `ex_date` > '2026-12-31' OR `payable_date` > '2026-12-31';

-- +migrate Down
-- 髒資料本身即為錯誤資料（來源亂碼），刪除後無法還原，故無 Down 動作。
SELECT 1;
