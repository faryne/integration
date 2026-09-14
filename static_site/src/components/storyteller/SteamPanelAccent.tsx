import { Box } from "@mui/material";
import type { Theme } from "@mui/material";

// steamPanelTopBarSx 放在 data/storytellerTheme.ts（不是這個檔案）——這個檔案只能
// 匯出元件，不然 fast refresh 會失效。

function registrationMarkSx(inset: number, side: "left" | "right") {
  return {
    position: "absolute",
    top: inset,
    [side]: inset,
    width: 9,
    height: 9,
    borderTop: "1px solid",
    borderColor: (theme: Theme) => theme.palette.primary.main,
    [side === "left" ? "borderLeft" : "borderRight"]: "1px solid",
    opacity: 0.6,
    pointerEvents: "none",
  };
}

/** 保留舊 API，實際呈現改為織造套色用的角落定位標記。 */
export function SteamRegistrationMarks({ inset = 8 }: { inset?: number }) {
  return (
    <>
      <Box sx={registrationMarkSx(inset, "left")} />
      <Box sx={registrationMarkSx(inset, "right")} />
    </>
  );
}
