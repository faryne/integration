import type { ListByPaginationRequest } from "@/apis/interfaces";
import type { VideoSearchRequest } from "@/apis/av/video_search";
import { AV_VIDEO_EXACT_FILTERS } from "@/data/avVideoFilters.ts";

// AV 影片搜尋頁：網址參數 ⇄ 搜尋條件。標籤可複選，用 getAll／append 處理重複的 tag 參數

const parsePositiveInt = (value: string | null) => {
  if (!value) return undefined;
  const parsed = parseInt(value, 10);
  return Number.isNaN(parsed) || parsed <= 0 ? undefined : parsed;
};

export const parseVideoSearchParams = (
  query: URLSearchParams,
): ListByPaginationRequest<VideoSearchRequest> => {
  const search: ListByPaginationRequest<VideoSearchRequest> = {
    page: parsePositiveInt(query.get("page")) ?? 1,
  };
  const keyword = query.get("keyword")?.trim();
  const startDate = query.get("start_date")?.trim();
  const endDate = query.get("end_date")?.trim();
  if (keyword) search.keyword = keyword;
  if (startDate) search.start_date = startDate;
  if (endDate) search.end_date = endDate;

  const tags = [
    ...new Set(
      query
        .getAll("tag")
        .map((t) => t.trim())
        .filter(Boolean),
    ),
  ];
  if (tags.length > 0) search.tag = tags;
  for (const { param } of AV_VIDEO_EXACT_FILTERS) {
    const value = query.get(param)?.trim();
    if (value) search[param] = value;
  }
  // 出演條件指定是哪一位（同名女優分得開）：joyu「我的追蹤」頁的「到搜尋頁看全部」、追蹤的搜尋條件會帶
  if (search.actress) {
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
  for (const tag of search.tag ?? []) query.append("tag", tag);
  for (const { param } of AV_VIDEO_EXACT_FILTERS) {
    const value = search[param]?.trim();
    if (value) query.set(param, value);
  }
  // 指定女優的 ID 只跟著出演條件走：拿掉出演條件時一起消失
  if (search.actress?.trim()) {
    if (search.xcity_id) query.set("xcity_id", String(search.xcity_id));
    if (search.manual_id) query.set("manual_id", String(search.manual_id));
    if (search.dmm_id) query.set("dmm_id", search.dmm_id);
  }
  return query;
};
