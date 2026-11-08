import type { VideoSearchRequest } from "@/apis/av/video_search.ts";

// 影片搜尋頁「追蹤這個搜尋」的 value：跟後端 service/av/joyu_follow.go 的 normalizeSearchFollow 同一套規則，
// 前端才能直接比對「這組條件是不是已經追蹤了」。只收精確條件（女優加指定 ID、發售商、品牌、系列、監督、標籤），
// 參數依名稱排序、標籤去重排序；編碼要跟 Go 的 url.Values.Encode 一樣（空白變 +，!'()* 也要編碼）

const KEYS = [
  "actress",
  "dmm_id",
  "director",
  "label",
  "maker",
  "manual_id",
  "series",
  "tag",
  "xcity_id",
] as const;
const CONDITION_KEYS = [
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

/** 沒有任何精確條件時回 undefined（只有關鍵字或日期不能追蹤） */
export function searchFollowValue(search: Partial<VideoSearchRequest>) {
  const parts: string[] = [];
  let hasCondition = false;
  for (const key of KEYS) {
    const raw = (search as Record<string, unknown>)[key];
    const values =
      key === "tag"
        ? [
            ...new Set(
              ((raw as string[] | undefined) ?? [])
                .map((t) => t.trim())
                .filter(Boolean),
            ),
          ].sort()
        : [String(raw ?? "").trim()].filter((v) => v && v !== "0");
    if (values.length && CONDITION_KEYS.includes(key)) hasCondition = true;
    values.forEach((v) => parts.push(`${key}=${goEscape(v)}`));
  }
  return hasCondition ? parts.join("&") : undefined;
}
