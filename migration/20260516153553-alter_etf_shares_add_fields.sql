-- +migrate Up
ALTER TABLE `etf_shares`
    ADD COLUMN `yield_rate` decimal(10, 4) NOT NULL DEFAULT 0 comment '單次殖利率。此欄位在除權日前一天有收盤價後計算出來',
    ADD COLUMN `filled_date` date NULL default '1900-01-01' comment '填息日',
    ADD COLUMN `ex_ticker_price` decimal(10, 4) NOT NULL DEFAULT 0 comment '除息收盤價',
    ADD COLUMN `filled_ticker_price` decimal(10, 4) NOT NULL DEFAULT 0 comment '填息收盤價',
    ADD COLUMN `filled_days` int(10) NOT NULL default -1 comment '填息所需日曆日，使用 datediff 計算。如果是 -1 代表未填息。',
    ADD COLUMN `filled_trade_days` int(10) NOT NULL default -1 comment '填息所需交易日，從 etf_ticker 找出列數。如果是 -1 代表未填息。';

-- +migrate Down
ALTER TABLE `etf_shares`
    DROP COLUMN `yield_rate`,
    DROP COLUMN `filled_date`,
    DROP COLUMN `ex_ticker_price`,
    DROP COLUMN `filled_ticker_price`,
    DROP COLUMN `filled_days`,
    DROP COLUMN `filled_trade_days`;
