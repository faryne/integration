import { createTheme, useMediaQuery } from "@mui/material";
import { useMemo } from "react";

/** galgame.tv 的 MUI 主題：跟隨系統深淺色。只由 GalgameLayout 套用，不影響其他站台。 */
export function useGalgameTheme() {
  const dark = useMediaQuery("(prefers-color-scheme: dark)", { noSsr: true });
  return useMemo(
    () =>
      createTheme({
        palette: dark
          ? {
              mode: "dark",
              primary: { main: "#5aa9f6" },
              background: { default: "#0f1115", paper: "#171a20" },
            }
          : { mode: "light", background: { default: "#f6f7f9" } },
        // 按鈕不轉大寫：英文介面整句大寫難讀，「YouTube」這類品牌名也會被改寫
        typography: { button: { textTransform: "none" } },
      }),
    [dark],
  );
}
