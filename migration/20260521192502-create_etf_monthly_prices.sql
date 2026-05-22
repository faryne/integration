
-- +migrate Up
CREATE TABLE `etf_monthly_prices` (
  `id` bigint(20) NOT NULL AUTO_INCREMENT,
  `code` varchar(20) NOT NULL,
  `year` int(11) NOT NULL,
  `month` int(11) NOT NULL,
  `avg_price` decimal(10,4) NOT NULL,
  `created_at` datetime NOT NULL,
  `updated_at` datetime NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `idx_code_year_month` (`code`,`year`,`month`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- +migrate Down
DROP TABLE `etf_monthly_prices`;
