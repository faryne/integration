-- +migrate Up
ALTER TABLE `etf_codes`
    MODIFY COLUMN  win_rate decimal(8, 4) NOT NULL DEFAULT 0 COMMENT '勝率';
-- +migrate Down
ALTER TABLE `etf_codes`
    MODIFY COLUMN  win_rate decimal(5, 3) NOT NULL DEFAULT 0 COMMENT '勝率';