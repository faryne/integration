-- +migrate Up
-- 頻道所屬事務所（之後擴充到 hololive 以外的企業勢／個人勢用）。目前只有 hololive，既有資料一律補 hololive。
-- 週更 job 的名冊清理只限同一家，手動加入的其他事務所／個人勢頻道才不會被當成「官網上不見了」軟刪除。
ALTER TABLE `vtuber_channels`
    ADD COLUMN `org_slug` VARCHAR(32) NOT NULL DEFAULT 'hololive' COMMENT '所屬事務所，例如 hololive、indie' AFTER `channel_id`,
    ADD KEY `idx_vtuber_channels_org_slug` (`org_slug`);

-- +migrate Down
ALTER TABLE `vtuber_channels`
    DROP KEY `idx_vtuber_channels_org_slug`,
    DROP COLUMN `org_slug`;
