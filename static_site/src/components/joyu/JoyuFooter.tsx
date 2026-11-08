import { Box, Container } from "@mui/material";

import { JOYU_SITE_NAME } from "@/helpers/joyu.ts";

import { joyuInk } from "./joyuTheme.ts";

/** joyu.fyi 頁尾：只放站名。刻意不連回 faryne.dev（跟主站切割），也不放 ©（站上的作品資料不是自己的版權） */
export function JoyuFooter() {
  return (
    <Box
      component="footer"
      sx={{
        flexShrink: 0,
        background: joyuInk.deep,
        borderTop: `1px solid ${joyuInk.line}`,
        color: joyuInk.textMuted,
        fontSize: 13,
      }}
    >
      <Container maxWidth={false} sx={{ maxWidth: 1280, py: 2.5 }}>
        {JOYU_SITE_NAME}
      </Container>
    </Box>
  );
}
