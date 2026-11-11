import type { ListByPaginationRequest } from "@/apis/interfaces";
import type { VideoSearchRequest } from "@/apis/av/video_search";
import { AV_VIDEO_EXACT_FILTERS } from "@/data/avVideoFilters.ts";

// AV 影片搜尋頁：網址參數 ⇄ 搜尋條件。精確篩選全部可複選，用 getAll／append 處理重複參數（舊網址的單值照樣能讀）

const parsePositiveInt = (value: string | null) => {
  if (!value) return undefined;
  const parsed = parseInt(value, 10);
  return Number.isNaN(parsed) || parsed <= 0 ? undefined : parsed;
};

// 去頭尾空白、拿掉空值與重複，保留原順序
const distinct = (values: string[]) => [
  ...new Set(values.map((v) => v.trim()).filter(Boolean)),
];

export const parseVideoSearchParams = (
  query: URLSearchParams,
): ListByPaginationRequest<VideoSearchRequest> => {
  const search: ListByPaginationRequest<VideoSearchRequest> = {
    page: parsePositiveInt(query.get("page")) ?? 1,
  };
  const keyword = query.get("keyword")?.trim();
  const startDate = query.get("start_date")?.trim();
  const endDate = query.get("end_date")?.trim();
  const durationMin = parsePositiveInt(query.get("duration_min"));
  const durationMax = parsePositiveInt(query.get("duration_max"));
  if (keyword) search.keyword = keyword;
  if (startDate) search.start_date = startDate;
  if (endDate) search.end_date = endDate;
  if (durationMin) search.duration_min = durationMin;
  if (durationMax) search.duration_max = durationMax;
  if (query.get("sort") === "oldest") search.sort = "oldest";
  const release = query.get("release");
  if (release === "upcoming" || release === "all") search.release = release;

  for (const { param } of AV_VIDEO_EXACT_FILTERS) {
    const values = distinct(query.getAll(param));
    if (values.length > 0) search[param] = values;
  }
  // 出演指定是哪一位（同名女優分得開）：剛好一位出演時才有意義，兩位以上照名字比對（跟後端一致）
  if (search.actress?.length === 1) {
    const xcityID = parsePositiveInt(query.get("xcity_id"));
    const manualID = parsePositiveInt(query.get("manual_id"));
    const dmmID = query.get("dmm_id")?.trim();
    if (xcityID) search.xcity_id = xcityID;
    if (manualID) search.manual_id = manualID;
    if (dmmID) search.dmm_id = dmmID;
  }
  return search;
};

export const videoSearchToParams = (
  search: ListByPaginationRequest<VideoSearchRequest>,
) => {
  const query = new URLSearchParams();
  const page = search.page ?? 1;
  if (page > 1) query.set("page", String(page));
  if (search.keyword?.trim()) query.set("keyword", search.keyword.trim());
  if (search.start_date) query.set("start_date", search.start_date);
  if (search.end_date) query.set("end_date", search.end_date);
  if (search.duration_min)
    query.set("duration_min", String(search.duration_min));
  if (search.duration_max)
    query.set("duration_max", String(search.duration_max));
  if (search.sort === "oldest") query.set("sort", "oldest");
  if (search.release) query.set("release", search.release);
  for (const { param } of AV_VIDEO_EXACT_FILTERS) {
    for (const v of distinct(search[param] ?? [])) query.append(param, v);
  }
  // 指定女優的 ID 只跟著「剛好一位出演」走：出演拿掉或多加一位時一起消失
  if (distinct(search.actress ?? []).length === 1) {
    if (search.xcity_id) query.set("xcity_id", String(search.xcity_id));
    if (search.manual_id) query.set("manual_id", String(search.manual_id));
    if (search.dmm_id) query.set("dmm_id", search.dmm_id);
  }
  return query;
};
