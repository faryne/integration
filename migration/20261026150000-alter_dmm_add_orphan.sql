-- +migrate Up
-- 詳細頁「同步資料」向 DMM 重抓時確定失敗（已下架、DMM 沒提供官方番號）就標成 orphan：
-- 前端不再顯示同步按鈕，之後的批次補資料程式也可以據此跳過。每日同步重新抓到這部作品時會清回 0。
ALTER TABLE `dmm`
    ADD COLUMN `is_orphan` TINYINT(1) NOT NULL DEFAULT 0 COMMENT 'DMM 已查無或無官方番號，不再嘗試同步' AFTER `info`,
    ADD COLUMN `orphaned_at` TIMESTAMP NULL DEFAULT NULL COMMENT '標記為 orphan 的時間' AFTER `is_orphan`;

-- +migrate Down
ALTER TABLE `dmm`
    DROP COLUMN `orphaned_at`,
    DROP COLUMN `is_orphan`;
