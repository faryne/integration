import type {
  VideoFieldKey,
  VideoFields,
  VideoTermKey,
} from "@/types/avVideoSubmission.ts";

/** 影片修改欄位的中文名稱，diff 表格依這個順序列出（與後端 VideoEditableFields 同序） */
export const VIDEO_FIELD_LABELS: Record<VideoFieldKey, string> = {
  title: "標題",
  maker_no: "官方番號",
  vod_date: "配信日",
  publish_date: "發售日",
  duration: "片長",
  actresses: "出演",
  directors: "監督",
  series: "系列",
  makers: "發售商",
  labels: "品牌",
  tags: "標籤",
  links: "參考連結",
};

export const VIDEO_FIELD_KEYS = Object.keys(
  VIDEO_FIELD_LABELS,
) as VideoFieldKey[];

export const VIDEO_TERM_KEYS: VideoTermKey[] = [
  "actresses",
  "directors",
  "series",
  "makers",
  "labels",
  "tags",
];

/** 日期：YYYY/MM/DD 或 YYYY-MM-DD（與後端驗證一致，送出後統一成 YYYY/MM/DD） */
export const VIDEO_DATE_PATTERN = /^\d{4}[/-]\d{1,2}[/-]\d{1,2}$/;

export const EMPTY_VIDEO_FIELDS: VideoFields = {
  title: "",
  maker_no: "",
  vod_date: "",
  publish_date: "",
  duration: 0,
  actresses: [],
  directors: [],
  series: [],
  makers: [],
  labels: [],
  tags: [],
  links: [],
};
