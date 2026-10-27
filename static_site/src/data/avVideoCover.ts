// DMM 封面（ps.jpg）是直式，約 1429×1944；列表、相關作品等固定比例的卡片都用這個比例，
// 跟詳細頁照原比例顯示的封面一致，不會被裁成橫的
export const AV_COVER_ASPECT_RATIO = "1429 / 1944";

// 影片結果格線：直式封面，手機 2 欄、平板 3 欄、桌機 4 欄（搜尋頁與女優頁共用）
export const AV_VIDEO_GRID_COLUMNS = {
  xs: "repeat(2, minmax(0, 1fr))",
  sm: "repeat(3, minmax(0, 1fr))",
  lg: "repeat(4, minmax(0, 1fr))",
};
