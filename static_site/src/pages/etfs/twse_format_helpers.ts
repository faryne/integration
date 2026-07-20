import dayjs from "dayjs";

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
