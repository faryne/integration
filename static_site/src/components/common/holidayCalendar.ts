import dayjs, { type Dayjs } from "dayjs";

// 通用日曆元件（HolidayCalendar）的型別與日期計算；元件本體見 HolidayCalendar.tsx。

export interface HolidayCalendarDay {
  date: Dayjs;
  isHoliday: boolean;
  // 備註：節日名稱、補假、補行上班…
  note?: string;
}

// 依西元年分組的資料；Map 與 Record 皆可，沒有資料就是一般萬年曆
export type HolidayCalendarData =
  Map<number, HolidayCalendarDay[]> | Record<number, HolidayCalendarDay[]>;

export const WEEKDAY_LABELS = ["日", "一", "二", "三", "四", "五", "六"];

// 日期比對一律用這個 key，只看年月日、忽略時分秒
export const dateKey = (date: Dayjs) => date.format("YYYY-MM-DD");

// 把分年資料攤平成「日期 → 資料」索引，渲染時 O(1) 查詢
export function indexHolidayCalendarData(data?: HolidayCalendarData) {
  const index = new Map<string, HolidayCalendarDay>();
  if (!data) return index;
  const years = data instanceof Map ? data.values() : Object.values(data);
  for (const days of years) {
    for (const day of days) index.set(dateKey(day.date), day);
  }
  return index;
}

// 月檢視固定 6 週（42 天），從當月 1 號所在週的週日開始，切月份時高度不跳動
export function monthGrid(month: Dayjs) {
  const start = month
    .startOf("month")
    .subtract(month.startOf("month").day(), "day");
  return Array.from({ length: 42 }, (_, i) => start.add(i, "day"));
}

// 民國年：1912 年為民國元年，之前顯示「民國前 N 年」
export function yearLabel(year: number, isROCYear: boolean) {
  if (!isROCYear) return `${year} 年`;
  return year >= 1912 ? `民國 ${year - 1911} 年` : `民國前 ${1912 - year} 年`;
}

export const isWeekend = (date: Dayjs) => date.day() === 0 || date.day() === 6;

// 給 aria-label 用的完整日期描述
export function dateDescription(
  date: Dayjs,
  isROCYear: boolean,
  info?: HolidayCalendarDay,
) {
  const status = info
    ? info.isHoliday
      ? "放假"
      : isWeekend(date)
        ? "補班"
        : "上班"
    : "";
  return [
    `${yearLabel(date.year(), isROCYear).replace(/ /g, "")}${date.month() + 1}月${date.date()}日`,
    `星期${WEEKDAY_LABELS[date.day()]}`,
    status,
    info?.note,
  ]
    .filter(Boolean)
    .join(" ");
}

export const today = () => dayjs().startOf("day");
