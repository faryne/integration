-- +migrate Up
ALTER TABLE `etf_codes`
    ADD COLUMN total_ex_count INT(10) NOT NULL DEFAULT 0 COMMENT '總除息次數',
    ADD COLUMN success_fill_count INT(10) NOT NULL DEFAULT 0 COMMENT '成功填息次數',
    ADD COLUMN win_rate decimal(5, 3) NOT NULL DEFAULT 0 COMMENT '勝率',
    ADD COLUMN avg_fill_days INT(10) NOT NULL DEFAULT 0 COMMENT '平均填息所需日曆日';

-- +migrate Down
ALTER TABLE `etf_codes`
    DROP COLUMN total_ex_count,
    DROP COLUMN success_fill_count,
    DROP COLUMN win_rate,
    DROP COLUMN avg_fill_days;
