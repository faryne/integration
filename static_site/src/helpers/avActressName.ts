/**
 * DMM 的女優名字常把別名寫在括號裡：「澤村レイコ（高坂保奈美、高坂ますみ）」，少數是半形括號。
 * 去掉括號只留本名，連到女優頁／女優搜尋才找得到人（與後端 actressBaseName 相同規則）
 */
export const actressBaseName = (name: string) => name.split(/[（(]/)[0].trim();

/**
 * 影片出演 chip 的連結：有 DMM 女優 ID 直接到女優頁，由對照表找出是同名中的哪一位；
 * 沒有 ID（舊影片、手動加的出演）到女優搜尋頁。名字去掉括號裡的別名，女優頁才查得到人
 */
export function videoActressPath(credit: string, dmmID?: string) {
  const name = encodeURIComponent(actressBaseName(credit));
  return dmmID
    ? `/av/actress/${name}?dmm_id=${encodeURIComponent(dmmID)}`
    : `/av/actress?name=${name}`;
}
