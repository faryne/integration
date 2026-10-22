import { Outlet } from "react-router-dom";
import { Box } from "@mui/material";
import type { FC } from "react";

import { SiteFooter } from "@/components/common/siteLayout/SiteFooter.tsx";
import { SiteHeader } from "@/components/common/siteLayout/SiteHeader.tsx";

/** 首頁 layout：固定深色實驗室背景，header／footer 與內頁共用 */
export const LabLayout: FC = () => {
  return (
    <Box
      sx={{
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        color: "#e8fbff",
        backgroundColor: "#05080c",
        backgroundImage: [
          "radial-gradient(circle at 16% 18%, rgba(18, 238, 207, 0.16), transparent 28%)",
          "radial-gradient(circle at 82% 14%, rgba(109, 92, 255, 0.16), transparent 24%)",
          "linear-gradient(180deg, rgba(5, 8, 12, 0.72), #05080c 68%)",
          "url('https://images.unsplash.com/photo-1532187643603-ba119ca4109e?auto=format&fit=crop&w=2200&q=80')",
        ].join(", "),
        backgroundAttachment: { xs: "scroll", md: "fixed" },
        backgroundPosition: "center top",
        backgroundSize: "cover",
      }}
    >
      {/* 首頁固定深色，不提供色彩模式切換 */}
      <SiteHeader showColorMode={false} />
      <Box component="main" sx={{ flex: "1 0 auto" }}>
        <Outlet />
      </Box>
      <SiteFooter />
    </Box>
  );
};
