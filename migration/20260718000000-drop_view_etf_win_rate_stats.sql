-- +migrate Up
DROP VIEW IF EXISTS `view_etf_win_rate_stats`;

-- +migrate Down
CREATE OR REPLACE VIEW view_etf_win_rate_stats AS
SELECT
    s.code,
    s.ex_date,
    s.share AS dividend_amount,
    -- 1. 取得除息前一日收盤價
    (SELECT t1.close FROM etf_tickers t1
     WHERE t1.code = s.code AND t1.ticker_date < s.ex_date
     ORDER BY t1.ticker_date DESC LIMIT 1) AS pre_ex_close_price,

    -- 2. 計算殖利率 (重複使用子查詢邏輯)
    ROUND((s.share / (SELECT t1.close FROM etf_tickers t1
                      WHERE t1.code = s.code AND t1.ticker_date < s.ex_date
                      ORDER BY t1.ticker_date DESC LIMIT 1)) * 100, 2) AS yield_rate,

    -- 3. 取得填息日期
    (SELECT t2.ticker_date FROM etf_tickers t2
     WHERE t2.code = s.code AND t2.ticker_date >= s.ex_date
     AND t2.close >= (SELECT t1.close FROM etf_tickers t1
                      WHERE t1.code = s.code AND t1.ticker_date < s.ex_date
                      ORDER BY t1.ticker_date DESC LIMIT 1)
     ORDER BY t2.ticker_date ASC LIMIT 1) AS filled_date,

    -- 4. 取得填息日收盤價
    (SELECT t2.close FROM etf_tickers t2
     WHERE t2.code = s.code AND t2.ticker_date >= s.ex_date
     AND t2.close >= (SELECT t1.close FROM etf_tickers t1
                      WHERE t1.code = s.code AND t1.ticker_date < s.ex_date
                      ORDER BY t1.ticker_date DESC LIMIT 1)
     ORDER BY t2.ticker_date ASC LIMIT 1) AS filled_close_price

-- 注意：filled_days 和 filled_trade_days
-- 在 5.7 的 View 裡面也必須要把整段子查詢邏輯塞進去，
-- 或者先建立這個基礎 View，再建立第二個 View 來處理計算。
FROM etf_shares s;
