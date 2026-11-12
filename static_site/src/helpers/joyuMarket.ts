import { joyuPath } from "@/helpers/joyu.ts";

// joyu 女優股市前端共用的小工具（元件檔只能匯出元件，fast refresh 才會正常）

/** 個股頁網址 */
export const stockPath = (code: string) => joyuPath(`market/${code}`);

/** 漲跌顏色照台股習慣：紅漲綠跌，沒變灰色 */
export const changeColor = (pct: number) =>
  pct > 0.004 ? "error.main" : pct < -0.004 ? "success.main" : "text.secondary";
