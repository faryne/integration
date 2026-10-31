import type {
  ActressTopicGroupKey,
  ActressTopicSaveRequest,
} from "@/types/avActressTopic.ts";

// 主題管理編輯頁的選項；星座區間與後端 service/av/actress_topics.go 一致

export const TOPIC_HOROSCOPES = [
  { slug: "aries", label: "牡羊座" },
  { slug: "taurus", label: "金牛座" },
  { slug: "gemini", label: "雙子座" },
  { slug: "cancer", label: "巨蟹座" },
  { slug: "leo", label: "獅子座" },
  { slug: "virgo", label: "處女座" },
  { slug: "libra", label: "天秤座" },
  { slug: "scorpio", label: "天蠍座" },
  { slug: "sagittarius", label: "射手座" },
  { slug: "capricorn", label: "摩羯座" },
  { slug: "aquarius", label: "水瓶座" },
  { slug: "pisces", label: "雙魚座" },
];

export const TOPIC_BLOOD_TYPES = ["A", "B", "O", "AB"];

export const TOPIC_CUPS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");

export const TOPIC_GROUP_LABELS: Record<ActressTopicGroupKey, string> = {
  special: "特輯",
  body: "身材",
};

export const TOPIC_DEFAULT_SORT_LABELS: Record<
  ActressTopicSaveRequest["default_sort"],
  string
> = {
  videos: "出演數",
  recent: "最近出演",
  genre: "類型出演數",
  debut: "出道日",
};

/** 數值區間條件：欄位、標籤、單位 */
export const TOPIC_RANGE_FIELDS = [
  { key: "birth_year", label: "出生年", unit: "" },
  { key: "height", label: "身高", unit: "cm" },
  { key: "bust", label: "胸圍", unit: "" },
  { key: "waist", label: "腰圍", unit: "" },
  { key: "hips", label: "臀圍", unit: "" },
  { key: "hip_waist_diff", label: "臀腰差", unit: "" },
] as const;

export const EMPTY_TOPIC: ActressTopicSaveRequest = {
  slug: "",
  title: "",
  group_key: "special",
  default_sort: "videos",
  conditions: {},
};
