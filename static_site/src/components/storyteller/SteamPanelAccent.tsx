import { Box } from "@mui/material";
import type { Theme } from "@mui/material";

// steamPanelTopBarSx 放在 data/storytellerTheme.ts（不是這個檔案）——這個檔案只能
// 匯出元件，不然 fast refresh 會失效。

function rivetSx(inset: number, side: "left" | "right") {
  return {
    position: "absolute",
    top: inset,
    [side]: inset,
    width: 6,
    height: 6,
    borderRadius: "50%",
    background: (theme: Theme) =>
      `radial-gradient(circle at 35% 30%, ${theme.palette.primary.light}, ${theme.palette.secondary.main} 70%)`,
    boxShadow: "0 1px 2px rgba(0,0,0,0.4)",
    pointerEvents: "none",
  };
}

/** 面板左上／右上角的鉚釘裝飾。父層要是 position:"relative"。 */
export function SteamRivets({ inset = 8 }: { inset?: number }) {
  return (
    <>
      <Box sx={rivetSx(inset, "left")} />
      <Box sx={rivetSx(inset, "right")} />
    </>
  );
}
