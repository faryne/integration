// 原始資料的數值是字串（可能含千分位逗號），「-」或空值代表該年該縣市無資料
export const parseStatValue = (value: string | undefined) => {
  if (!value || value === "-") {
    return null;
  }
  const parsed = Number.parseFloat(value.replaceAll(",", ""));
  return Number.isFinite(parsed) ? parsed : null;
};
