-- +migrate Up
ALTER TABLE `taipower_neighbor`
  DROP INDEX `uniq_duplicate_hash`;

UPDATE `taipower_neighbor`
SET `cityarea` = CONCAT(
  CASE
    WHEN `unit` LIKE '%臺北市%' THEN '臺北市'
    WHEN `unit` LIKE '%台北市%' THEN '台北市'
    WHEN `unit` LIKE '%新北市%' THEN '新北市'
    WHEN `unit` LIKE '%桃園市%' THEN '桃園市'
    WHEN `unit` LIKE '%臺中市%' THEN '臺中市'
    WHEN `unit` LIKE '%台中市%' THEN '台中市'
    WHEN `unit` LIKE '%臺南市%' THEN '臺南市'
    WHEN `unit` LIKE '%台南市%' THEN '台南市'
    WHEN `unit` LIKE '%高雄市%' THEN '高雄市'
    WHEN `unit` LIKE '%基隆市%' THEN '基隆市'
    WHEN `unit` LIKE '%新竹市%' THEN '新竹市'
    WHEN `unit` LIKE '%嘉義市%' THEN '嘉義市'
    WHEN `unit` LIKE '%宜蘭縣%' THEN '宜蘭縣'
    WHEN `unit` LIKE '%新竹縣%' THEN '新竹縣'
    WHEN `unit` LIKE '%苗栗縣%' THEN '苗栗縣'
    WHEN `unit` LIKE '%彰化縣%' THEN '彰化縣'
    WHEN `unit` LIKE '%南投縣%' THEN '南投縣'
    WHEN `unit` LIKE '%雲林縣%' THEN '雲林縣'
    WHEN `unit` LIKE '%嘉義縣%' THEN '嘉義縣'
    WHEN `unit` LIKE '%屏東縣%' THEN '屏東縣'
    WHEN `unit` LIKE '%花蓮縣%' THEN '花蓮縣'
    WHEN `unit` LIKE '%臺東縣%' THEN '臺東縣'
    WHEN `unit` LIKE '%台東縣%' THEN '台東縣'
    WHEN `unit` LIKE '%澎湖縣%' THEN '澎湖縣'
    WHEN `unit` LIKE '%金門縣%' THEN '金門縣'
    WHEN `unit` LIKE '%連江縣%' THEN '連江縣'
    WHEN `unit` LIKE '%臺北縣%' THEN '臺北縣'
    WHEN `unit` LIKE '%台北縣%' THEN '台北縣'
    WHEN `unit` LIKE '%桃園縣%' THEN '桃園縣'
    WHEN `unit` LIKE '%臺中縣%' THEN '臺中縣'
    WHEN `unit` LIKE '%台中縣%' THEN '台中縣'
    WHEN `unit` LIKE '%臺南縣%' THEN '臺南縣'
    WHEN `unit` LIKE '%台南縣%' THEN '台南縣'
    WHEN `unit` LIKE '%高雄縣%' THEN '高雄縣'
    ELSE ''
  END,
  `cityarea`
)
WHERE `cityarea` NOT REGEXP '^(臺北市|台北市|新北市|桃園市|臺中市|台中市|臺南市|台南市|高雄市|基隆市|新竹市|嘉義市|宜蘭縣|新竹縣|苗栗縣|彰化縣|南投縣|雲林縣|嘉義縣|屏東縣|花蓮縣|臺東縣|台東縣|澎湖縣|金門縣|連江縣|臺北縣|台北縣|桃園縣|臺中縣|台中縣|臺南縣|台南縣|高雄縣)'
  AND `unit` REGEXP '(臺北市|台北市|新北市|桃園市|臺中市|台中市|臺南市|台南市|高雄市|基隆市|新竹市|嘉義市|宜蘭縣|新竹縣|苗栗縣|彰化縣|南投縣|雲林縣|嘉義縣|屏東縣|花蓮縣|臺東縣|台東縣|澎湖縣|金門縣|連江縣|臺北縣|台北縣|桃園縣|臺中縣|台中縣|臺南縣|台南縣|高雄縣)';

UPDATE `taipower_neighbor`
SET `duplicate_hash` = SHA2(
  CONCAT_WS(
    CHAR(31),
    `obj_year`,
    `obj_month`,
    `cityarea`,
    `unit`,
    `summary`,
    REPLACE(FORMAT(`cash`, 6), ',', '')
  ),
  256
);

UPDATE `taipower_neighbor` AS duplicate
INNER JOIN (
  SELECT grouped.`duplicate_hash`, grouped.`first_id`
  FROM (
    SELECT `duplicate_hash`, MIN(`id`) AS `first_id`
    FROM `taipower_neighbor`
    GROUP BY `duplicate_hash`
    HAVING COUNT(*) > 1
  ) AS grouped
) AS duplicated
  ON duplicated.`duplicate_hash` = duplicate.`duplicate_hash`
  AND duplicate.`id` <> duplicated.`first_id`
SET duplicate.`duplicate_hash` = SHA2(
  CONCAT(duplicate.`duplicate_hash`, ':legacy:', duplicate.`id`),
  256
);

ALTER TABLE `taipower_neighbor`
  ADD UNIQUE KEY `uniq_duplicate_hash` (`duplicate_hash`);

-- +migrate Down
-- This normalization is intentionally irreversible because the original
-- abbreviated cityarea cannot be reconstructed reliably.
