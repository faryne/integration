import type {
  ActressFieldKey,
  ActressFields,
} from "@/types/avActressSubmission.ts";

/** 上稿欄位的中文名稱，diff 表格依這個順序列出 */
export const ACTRESS_FIELD_LABELS: Record<ActressFieldKey, string> = {
  name: "姓名",
  aliases: "別名",
  kana: "假名",
  photo: "照片網址",
  height: "身高",
  bust: "胸圍（B）",
  waist: "腰圍（W）",
  hips: "臀圍（H）",
  cup: "罩杯",
  blood: "血型",
  born_city: "出生地",
  birth_year: "生日・年",
  birth_month: "生日・月",
  birth_day: "生日・日",
  interests: "興趣",
  links: "參考連結",
};

export const ACTRESS_FIELD_KEYS = Object.keys(
  ACTRESS_FIELD_LABELS,
) as ActressFieldKey[];

/** 罩杯：AAA、AA、A～Z（與後端驗證一致） */
export const ACTRESS_CUP_PATTERN = /^(A{1,3}|[B-Z])$/;

export const EMPTY_ACTRESS_FIELDS: ActressFields = {
  name: "",
  kana: "",
  photo: "",
  height: 0,
  bust: 0,
  waist: 0,
  hips: 0,
  cup: "",
  blood: "",
  born_city: "",
  birth_year: 0,
  birth_month: 0,
  birth_day: 0,
  interests: [],
  links: [],
  aliases: [],
};
