import { siteInk } from "./siteTheme.ts";

/** header 右側方形圖示按鈕（色彩模式、手機選單） */
// 不標 SxProps 型別：保留一般物件才能放進 sx 陣列或展開合併
export const headerIconButtonSx = {
  width: 34,
  height: 34,
  borderRadius: 2,
  border: `1px solid ${siteInk.line}`,
  bgcolor: "rgba(9, 22, 28, 0.6)",
  color: siteInk.text,
  "&:hover": { borderColor: "rgba(114, 255, 240, 0.6)", color: siteInk.glow },
};

/** header 彈出選單（色彩模式、帳號）的墨色外框 */
export const headerMenuPaperSx = {
  mt: 1,
  minWidth: 180,
  color: siteInk.text,
  background: siteInk.panel,
  border: `1px solid ${siteInk.line}`,
  boxShadow: "0 18px 40px rgba(0, 0, 0, 0.45)",
  "& .MuiListItemIcon-root": { color: "inherit", opacity: 0.8 },
  "& .MuiMenuItem-root:hover": { bgcolor: siteInk.hover },
  "& .MuiMenuItem-root.Mui-selected, & .MuiMenuItem-root.Mui-selected:hover": {
    bgcolor: "transparent",
    color: siteInk.glow,
  },
  "& .MuiDivider-root": { borderColor: siteInk.line },
};
