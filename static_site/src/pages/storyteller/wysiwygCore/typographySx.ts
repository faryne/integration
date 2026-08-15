/**
 * 編輯區跟預覽區共用同一份標題排版樣式。
 *
 * 之前只在預覽區重置了 margin，字級大小完全沒設，兩邊都吃瀏覽器對 h1~h6 的預設樣式——
 * 編輯區因為連 margin 重置都沒有，預設的大 margin 疊上大字級跳動，看起來特別亂。
 * 兩個面板共用同一份樣式，也順便確保「編輯區看到的樣子」跟「預覽區（未來的閱讀頁）看到的樣子」一致，
 * 這本來就是所見即所得編輯器該有的樣子。
 */
export const HEADING_TYPOGRAPHY_SX = {
  "& p, & h1, & h2, & h3, & h4, & h5, & h6": {
    margin: "0 0 0.5em 0",
    minHeight: "1.5em",
    lineHeight: 1.5,
    fontWeight: 400,
    fontSize: "1em",
    // 頁面上方有 fixed 的 ModernHeader，捲動到標題時要預留同等高度，
    // 否則標題會被 header 蓋住，看起來像是捲到下一行去了
    scrollMarginTop: 80,
  },
  "& h1": { fontSize: "1.8em", fontWeight: 700 },
  "& h2": { fontSize: "1.5em", fontWeight: 700 },
  "& h3": { fontSize: "1.25em", fontWeight: 700 },
  "& h4": { fontSize: "1.1em", fontWeight: 700 },
  "& h5": { fontSize: "1em", fontWeight: 700 },
  "& h6": { fontSize: "0.9em", fontWeight: 700, color: "text.secondary" },
} as const;
