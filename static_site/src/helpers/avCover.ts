// DMM 封面網址慣例：ps＝直式封面、pt＝舊資料的小縮圖（90×122）、pl＝整片外盒大圖（封底＋書背＋封面）。
// 舊作的 ps 只有 147×200，pl 也有 800px 寬，封面貼齊 pl 的右側，可以裁右側來顯示

// 小於這個寬度的 ps 視為舊作低解析封面，改用 pl 右側裁切
export const AV_COVER_LOW_RES_WIDTH = 400;

const COVER_SUFFIX = /p[st]\.jpg$/;

/** 封面網址換成同路徑的 pl.jpg；不是 DMM 慣例格式就回傳 null */
export function avPackageLargeUrl(thumb: string) {
  return COVER_SUFFIX.test(thumb)
    ? thumb.replace(COVER_SUFFIX, "pl.jpg")
    : null;
}

/** pt.jpg 一定是舊資料的小縮圖，不用等載入就直接改用 pl */
export function isAvTinyThumb(thumb: string) {
  return thumb.endsWith("pt.jpg");
}
