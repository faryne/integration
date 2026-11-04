/**
 * 比對表的欄位定義：女優上稿、影片修改各給一份，表格本身共用。
 * 陣列欄位（listKeys）逐項標出新增／移除；項目可以是字串或參考連結
 */
export interface SubmissionDiffSpec<F, K extends keyof F> {
  keys: K[];
  labels: Record<K, string>;
  /** 單一欄位的顯示文字；空字串顯示「（未填）」 */
  format: (f: F, key: K) => string;
  listKeys: K[];
  /** 陣列欄位的項目要連到哪裡（例如影片的出演連到女優頁）；沒有就不加連結 */
  itemHref?: (key: K, item: string) => string | undefined;
  /** 陣列欄位的項目旁邊要不要加註（例如影片的「新值」） */
  itemNote?: (key: K, item: string) => string | undefined;
}

/** 兩份資料不同的欄位（照 spec.keys 的順序） */
export function changedSubmissionFields<F, K extends keyof F>(
  spec: Pick<SubmissionDiffSpec<F, K>, "keys">,
  a: F,
  b: F,
): K[] {
  return spec.keys.filter((k) => JSON.stringify(a[k]) !== JSON.stringify(b[k]));
}
