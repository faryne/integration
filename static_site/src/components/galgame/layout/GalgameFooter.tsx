import WarningAmberIcon from "@mui/icons-material/WarningAmber";
import { Box, Container, Divider, Typography } from "@mui/material";

import IndependentFooter from "@/components/common/IndependentFooter.tsx";

/**
 * 精簡頁尾：警語預設收合成一行，展開才顯示全文。
 * 警語屬法律聲明，刻意維持中英對照、不走 i18n。
 */
export function GalgameFooter() {
  return (
    <Box component="footer" sx={{ mt: 6, bgcolor: "background.paper" }}>
      <Divider />
      <Container maxWidth="lg">
        <Box
          component="details"
          sx={{
            pt: 2,
            color: "text.secondary",
            "& summary": { cursor: "pointer" },
          }}
        >
          <Typography
            component="summary"
            variant="body2"
            sx={{
              color: "text.primary",
              display: "flex",
              alignItems: "center",
              gap: 0.75,
            }}
          >
            <WarningAmberIcon fontSize="small" sx={{ color: "warning.main" }} />
            警語與版權宣告 / Disclaimer and Copyright Notice
          </Typography>
          <Typography
            variant="caption"
            component="p"
            sx={{ lineHeight: 1.6, mt: 1 }}
          >
            本網站整理公開可嵌入之官方 YouTube
            影片資訊，影片與商標權利均屬原權利人所有。內容可能涉及成人向遊戲或不適合未成年人之題材，請依所在地法律與平台規範自行判斷是否瀏覽。
          </Typography>
          <Typography
            variant="caption"
            component="p"
            sx={{ lineHeight: 1.6, mt: 1, fontStyle: "italic" }}
          >
            This site indexes publicly embeddable official YouTube video
            metadata. Videos, trademarks, and related rights belong to their
            respective owners. Some content may involve adult-oriented games or
            themes unsuitable for minors; please follow local laws and platform
            rules.
          </Typography>
        </Box>
        <IndependentFooter service_name="Galgame TV" />
      </Container>
    </Box>
  );
}
