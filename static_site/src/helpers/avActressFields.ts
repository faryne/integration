import type { Actress, ActressLink } from "@/types/av.ts";
import type {
  ActressFieldKey,
  ActressFields,
} from "@/types/avActressSubmission.ts";
import {
  ACTRESS_FIELD_KEYS,
  EMPTY_ACTRESS_FIELDS,
} from "@/data/avActressFields.ts";

/** 搜尋結果的女優轉成上稿欄位（修改表單預填用）；舊資料的數值可能是字串或缺欄位 */
export function actressToFields(actress: Actress): ActressFields {
  return {
    ...EMPTY_ACTRESS_FIELDS,
    name: actress.name ?? "",
    kana: actress.kana ?? "",
    photo: actress.photo ?? "",
    height: Number(actress.height) || 0,
    bust: Number(actress.bust) || 0,
    waist: Number(actress.waist) || 0,
    hips: Number(actress.hips) || 0,
    cup: actress.cup ?? "",
    blood: actress.blood ?? "",
    born_city: actress.born_city ?? "",
    birth_year: actress.birth_year || 0,
    birth_month: actress.birth_month || 0,
    birth_day: actress.birth_day || 0,
    interests: (actress.interests ?? []).map(String),
    links: actress.links ?? [],
  };
}

/** 兩份資料不同的欄位 */
export function changedActressFields(
  a: ActressFields,
  b: ActressFields,
): ActressFieldKey[] {
  return ACTRESS_FIELD_KEYS.filter(
    (k) => JSON.stringify(a[k]) !== JSON.stringify(b[k]),
  );
}

/** 單一欄位的顯示文字；0 與空字串都是「未填」，回傳空字串 */
export function formatActressField(f: ActressFields, key: ActressFieldKey) {
  const v = f[key];
  if (key === "links")
    return (v as ActressLink[])
      .map((l) => `${linkLabel(l)}｜${l.url}`)
      .join("\n");
  if (Array.isArray(v)) return v.join("、");
  if (typeof v === "number") {
    if (!v) return "";
    return ["height", "bust", "waist", "hips"].includes(key)
      ? `${v}cm`
      : String(v);
  }
  return v;
}

/** 網址的網域（去掉 www.），連結沒填名稱時顯示 */
export function linkHost(url: string) {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

export function linkLabel(link: ActressLink) {
  return link.title || linkHost(link.url);
}

/**
 * 新增單合併到同名女優後的結果（與後端 mergeActressFields 相同規則）：
 * 提交有填的欄位覆寫、沒填的保留；興趣與參考連結取聯集。審核頁用來預覽合併後的差異
 */
export function mergeActressFields(
  current: ActressFields,
  submitted: ActressFields,
): ActressFields {
  const merged = { ...current };
  for (const key of ACTRESS_FIELD_KEYS) {
    const v = submitted[key];
    if (key !== "interests" && key !== "links" && v)
      (merged as Record<string, unknown>)[key] = v;
  }
  merged.interests = [
    ...current.interests,
    ...submitted.interests.filter((i) => !current.interests.includes(i)),
  ];
  merged.links = [
    ...current.links,
    ...submitted.links.filter(
      (l) => !current.links.some((c) => c.url === l.url),
    ),
  ];
  return merged;
}
