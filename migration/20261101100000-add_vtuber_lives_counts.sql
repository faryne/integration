-- +migrate Up
-- 藝人頁直播統計：同接峰值、觀看與按讚數。
-- concurrent_viewers 是「最後一次看到的值」，直播結束就清成 NULL，不能拿來當峰值，所以另開 peak_viewers。
ALTER TABLE `vtuber_lives`
    ADD COLUMN `peak_viewers` INT UNSIGNED NULL DEFAULT NULL COMMENT '偵測時看過的最高同接，結束後保留' AFTER `concurrent_viewers`,
    ADD COLUMN `view_count` BIGINT UNSIGNED NULL DEFAULT NULL COMMENT '觀看數，結束 7 天後不再更新' AFTER `peak_viewers`,
    ADD COLUMN `like_count` BIGINT UNSIGNED NULL DEFAULT NULL COMMENT '按讚數，頻道關閉公開讚數時為 NULL' AFTER `view_count`,
    ADD KEY `idx_vtuber_lives_channel_actual_start` (`channel_id`, `actual_start_at`);

-- +migrate Down
ALTER TABLE `vtuber_lives`
    DROP KEY `idx_vtuber_lives_channel_actual_start`,
    DROP COLUMN `like_count`,
    DROP COLUMN `view_count`,
    DROP COLUMN `peak_viewers`;
