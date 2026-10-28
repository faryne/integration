/**
 * 女優尺寸區間（身高／三圍）的顯示文字，搜尋表單與結果頁條件 chip 共用。
 * 0 代表該側不限：只填最小 →「180cm 以上」、只填最大 →「170cm 以下」，兩側都有才用「~」
 */
export function formatSizeRange(value: number[] | undefined, unit = "cm") {
  const [min = 0, max = 0] = value ?? [];
  if (min > 0 && max > 0) return `${min}~${max}${unit}`;
  if (min > 0) return `${min}${unit} 以上`;
  if (max > 0) return `${max}${unit} 以下`;
  return "不限";
}
