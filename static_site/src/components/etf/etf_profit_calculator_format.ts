// 獲利試算相關頁面（試算結果卡片、明細表、我的最愛總覽）共用的金額/報酬率格式化，
// 抽出來避免各自實作導致小數位數不一致。
export const formatCurrencyAmount = (
  currencySymbol: string,
  amount: number,
  decimals: number,
) =>
  `${currencySymbol}${amount.toLocaleString(undefined, {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  })}`;

export const formatRate = (rate: number | null, noRateText = "--") =>
  rate === null ? noRateText : `${rate >= 0 ? "+" : ""}${rate.toFixed(2)}%`;
