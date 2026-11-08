import type { VideoSearchRequest } from "@/apis/av/video_search.ts";

// 影片搜尋頁「追蹤這個搜尋」的 value：跟後端 service/av/joyu_follow.go 的 normalizeSearchFollow 同一套規則，
// 前端才能直接比對「這組條件是不是已經追蹤了」。收關鍵字與精確條件（女優加指定 ID、發售商、品牌、系列、監督、標籤），
// 參數依名稱排序、每個參數的值去重排序；編碼要跟 Go 的 url.Values.Encode 一樣（空白變 +，!'()* 也要編碼）

const KEYS = [
  "actress",
  "dmm_id",
  "director",
  "keyword",
  "label",
  "maker",
  "manual_id",
  "series",
  "tag",
  "xcity_id",
] as const;
const CONDITION_KEYS = [
  "keyword",
  "actress",
  "maker",
  "label",
  "series",
  "director",
  "tag",
];

const goEscape = (v: string) =>
  encodeURIComponent(v)
    .replace(
      /[!'()*]/g,
      (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`,
    )
    .replace(/%20/g, "+");

// 只收一個值的參數；其他（出演、發售商…、標籤）可複選
const SINGLE_KEYS = ["keyword", "xcity_id", "manual_id", "dmm_id"];
const ID_KEYS = ["xcity_id", "manual_id", "dmm_id"];

const valuesOf = (raw: unknown) =>
  [
    ...new Set(
      (Array.isArray(raw) ? raw : [raw]).map((v) => String(v ?? "").trim()),
    ),
  ].filter((v) => v && v !== "0");

/** 沒有任何條件時回 undefined（只有日期不能追蹤）；每個參數的值去重排序，兩位以上出演時不帶女優 ID */
export function searchFollowValue(search: Partial<VideoSearchRequest>) {
  const multiActress = valuesOf(search.actress).length > 1;
  const parts: string[] = [];
  let hasCondition = false;
  for (const key of KEYS) {
    if (multiActress && ID_KEYS.includes(key)) continue;
    let values = valuesOf((search as Record<string, unknown>)[key]);
    values = SINGLE_KEYS.includes(key) ? values.slice(0, 1) : values.sort();
    if (values.length && CONDITION_KEYS.includes(key)) hasCondition = true;
    values.forEach((v) => parts.push(`${key}=${goEscape(v)}`));
  }
  return hasCondition ? parts.join("&") : undefined;
}
