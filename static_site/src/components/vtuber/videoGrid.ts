// 影片卡片的格線：短片是直式縮圖，一列多放幾張（「所有影片」列表與影片搜尋共用）
export const videoGridSx = (shorts: boolean) => ({
  display: "grid",
  gridTemplateColumns: shorts
    ? { xs: "repeat(3, 1fr)", sm: "repeat(auto-fill, minmax(140px, 1fr))" }
    : { xs: "1fr 1fr", sm: "repeat(auto-fill, minmax(200px, 1fr))" },
  gap: { xs: shorts ? 1 : 1.25, sm: 1.5 },
});
