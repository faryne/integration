/**
 * DMM 的女優名字常把別名寫在括號裡：「澤村レイコ（高坂保奈美、高坂ますみ）」，少數是半形括號。
 * 去掉括號只留本名，連到女優頁／女優搜尋才找得到人（與後端 actressBaseName 相同規則）
 */
export const actressBaseName = (name: string) => name.split(/[（(]/)[0].trim();
