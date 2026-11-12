import { joyuPath } from "@/helpers/joyu.ts";

// joyu 女優股市前端共用的小工具（元件檔只能匯出元件，fast refresh 才會正常）

/** 個股頁網址 */
export const stockPath = (code: string) => joyuPath(`market/${code}`);

/** 漲跌顏色照台股習慣：紅漲綠跌，沒變灰色 */
export const changeColor = (pct: number) =>
  pct > 0.004 ? "error.main" : pct < -0.004 ? "success.main" : "text.secondary";

/** 金額顯示：千分位、小數兩位 */
export const money = (n: number) =>
  n.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

/** 帶正負號的百分比：+1.23% ／ -1.23% */
export const signedPct = (pct: number) =>
  `${pct > 0 ? "+" : ""}${pct.toFixed(2)}%`;

/** 大盤指數：每檔現價相對 IPO 價（10）的平均 × 1000，剛上市時就是 1000；prev 用昨收算 */
export const marketIndex = (prices: number[]) =>
  prices.length
    ? (prices.reduce((a, b) => a + b, 0) / prices.length / 10) * 1000
    : 0;
