-- +migrate Up
ALTER TABLE `etf_codes`
    ADD COLUMN `range_position` decimal(8, 4) NOT NULL DEFAULT 0 COMMENT '近一個月收盤價區間位置',
    ADD COLUMN `latest_close` decimal(10, 4) NOT NULL DEFAULT 0 COMMENT '最新收盤價',
    ADD COLUMN `ma5` decimal(10, 4) NOT NULL DEFAULT 0 COMMENT '五日均線',
    ADD COLUMN `ma20` decimal(10, 4) NOT NULL DEFAULT 0 COMMENT '二十日均線',
    ADD COLUMN `ma20_bias_rate` decimal(8, 4) NOT NULL DEFAULT 0 COMMENT '收盤價相對二十日均線乖離率';

ALTER TABLE `etf_tickers`
    ADD COLUMN `range_position_20` decimal(8, 4) NOT NULL DEFAULT 0 COMMENT '二十日收盤價區間位置',
    ADD COLUMN `range_position_60` decimal(8, 4) NOT NULL DEFAULT 0 COMMENT '六十日收盤價區間位置',
    ADD COLUMN `range_position_120` decimal(8, 4) NOT NULL DEFAULT 0 COMMENT '一百二十日收盤價區間位置',
    ADD COLUMN `ma5` decimal(10, 4) NOT NULL DEFAULT 0 COMMENT '五日均線',
    ADD COLUMN `ma20` decimal(10, 4) NOT NULL DEFAULT 0 COMMENT '二十日均線',
    ADD COLUMN `ma60` decimal(10, 4) NOT NULL DEFAULT 0 COMMENT '六十日均線',
    ADD COLUMN `ma120` decimal(10, 4) NOT NULL DEFAULT 0 COMMENT '一百二十日均線',
    ADD COLUMN `volume` bigint unsigned NOT NULL DEFAULT 0 COMMENT '成交量',
    ADD COLUMN `trading_money` bigint unsigned NOT NULL DEFAULT 0 COMMENT '成交金額',
    ADD COLUMN `trading_turnover` int unsigned NOT NULL DEFAULT 0 COMMENT '交易筆數';

-- +migrate Down
ALTER TABLE `etf_tickers`
    DROP COLUMN `range_position_20`,
    DROP COLUMN `range_position_60`,
    DROP COLUMN `range_position_120`,
    DROP COLUMN `ma5`,
    DROP COLUMN `ma20`,
    DROP COLUMN `ma60`,
    DROP COLUMN `ma120`,
    DROP COLUMN `volume`,
    DROP COLUMN `trading_money`,
    DROP COLUMN `trading_turnover`;

ALTER TABLE `etf_codes`
    DROP COLUMN `range_position`,
    DROP COLUMN `latest_close`,
    DROP COLUMN `ma5`,
    DROP COLUMN `ma20`,
    DROP COLUMN `ma20_bias_rate`;
