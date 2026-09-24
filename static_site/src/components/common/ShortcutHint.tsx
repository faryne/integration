import { Box } from "@mui/material";
import { shortcutLabel } from "@/helpers/shortcut.ts";

/**
 * 按鈕／輸入框旁的快捷鍵提示（Mac「⌘S」、Windows「Ctrl+S」）。
 * 觸控裝置（hover: none）通常沒有實體鍵盤，直接隱藏。
 */
export function ShortcutHint({ shortcutKey }: { shortcutKey: string }) {
  return (
    <Box
      component="kbd"
      sx={{
        ml: 0.75,
        fontFamily: "inherit",
        fontSize: "0.75em",
        opacity: 0.7,
        whiteSpace: "nowrap",
        "@media (hover: none)": { display: "none" },
      }}
    >
      {shortcutLabel(shortcutKey)}
    </Box>
  );
}
