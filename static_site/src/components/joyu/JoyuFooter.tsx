import { Box, Container } from "@mui/material";

import { siteInk } from "@/components/common/siteLayout/siteTheme.ts";
import { JOYU_SITE_NAME } from "@/helpers/joyu.ts";

/** joyu.fyi 頁尾：只放站名，刻意不連回 faryne.dev（跟主站切割，見 DevelopDocuments/opendata/joyu.fyi獨立站） */
export function JoyuFooter() {
  return (
    <Box
      component="footer"
      sx={{
        flexShrink: 0,
        background: siteInk.footer,
        borderTop: `1px solid ${siteInk.line}`,
        color: siteInk.textMuted,
        fontSize: 13,
      }}
    >
      <Container maxWidth={false} sx={{ maxWidth: 1280, py: 2.5 }}>
        © {new Date().getFullYear()} {JOYU_SITE_NAME}
      </Container>
    </Box>
  );
}
