import dayjs from "dayjs";

import type { EtfDistribution, TwseEtfShare } from "@/types/etf.ts";

// 這幾個格式化函式在 ETF 列表（EtfTableList）跟詳細頁 dialog（EtfDetailDialog）
// 都會用到，抽出來共用避免兩邊各寫一份。

export const formatDateOrDash = (value?: string) => {
  if (!value) return "--";
  const formatted = dayjs(value).format("YYYY-MM-DD");
  return formatted !== "0001-01-01" &&
    formatted !== "1900-01-01" &&
    formatted !== "Invalid Date"
    ? formatted
    : "--";
};

// 台股配息紀錄轉成獲利試算引擎吃的格式。後端日期是 datetime 字串，引擎用字串比較日期，
// 一定要先正規化成 YYYY-MM-DD，否則除息日當天會被誤判（"2026-10-27T…" > "2026-10-27"）。
// 詳細頁 dialog 跟「我的最愛」總覽頁共用，避免兩邊算出不同數字。
export const toTwseDistribution = (s: TwseEtfShare): EtfDistribution => ({
  per_share: s.share,
  declared_date: formatDateOrDash(s.ex_date),
  ex_date: formatDateOrDash(s.ex_date),
  payable_date: formatDateOrDash(s.payable_date),
  roc: -1, // 台股境內配息無 ROC 預扣退稅資料
});

export const getWinRateTone = (winRate: number) => {
  if (winRate >= 85) return "success.main";
  if (winRate > 0 && winRate <= 50) return "error.main";
  return "text.primary";
};

export const formatSignedPercent = (value?: number | null) => {
  if (value === null || value === undefined || Number.isNaN(value)) {
    return "--";
  }

  const prefix = value > 0 ? "+" : "";
  return `${prefix}${value.toFixed(2)}%`;
};

export const formatPercent = (value?: number | null) => {
  if (value === null || value === undefined || Number.isNaN(value)) {
    return "--";
  }
  return `${value.toFixed(2)}%`;
};

export const formatDecimal = (value?: number | null, digits = 2) => {
  if (value === null || value === undefined || Number.isNaN(value)) {
    return "--";
  }
  return value.toFixed(digits);
};
