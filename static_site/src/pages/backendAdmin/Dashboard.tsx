import { Link } from "react-router-dom";
import { Box, Paper, Stack, Typography } from "@mui/material";

import { useBackendAdminPendingCounts } from "@/apis/backendAdmin/pendingCounts.ts";
import { backendAdminNav } from "@/data/backendAdminNav.ts";

// 總覽卡片只列有待處理數量的模組，從側欄設定推導，新增模組時不用改這頁
const cards = backendAdminNav
  .map((group) => ({
    title: group.title,
    items: group.items.filter((item) => item.badge),
  }))
  .filter((group) => group.items.length > 0);

/** 後台首頁：各模組的待處理數量，點了進對應頁面 */
export function BackendAdminDashboard() {
  const counts = useBackendAdminPendingCounts();
  return (
    <Stack spacing={2}>
      <Typography component="h1" fontWeight={900} variant="h5">
        總覽
      </Typography>
      <Box
        sx={{
          display: "grid",
          gap: 2,
          gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))",
        }}
      >
        {cards.map((card) => (
          <Paper key={card.title} sx={{ p: 2 }} variant="outlined">
            <Typography fontWeight={900} sx={{ mb: 1 }}>
              {card.title}
            </Typography>
            {card.items.map((item) => {
              const count = item.badge ? counts[item.badge] : undefined;
              return (
                <Box
                  component={Link}
                  key={item.href}
                  sx={{
                    alignItems: "center",
                    borderRadius: 1,
                    color: "text.primary",
                    display: "flex",
                    justifyContent: "space-between",
                    px: 1.5,
                    py: 1,
                    textDecoration: "none",
                    "&:hover": { bgcolor: "action.hover" },
                  }}
                  to={item.href}
                >
                  {item.label}
                  <Typography
                    color={count ? "text.primary" : "text.secondary"}
                    fontSize={20}
                    fontWeight={count ? 800 : 500}
                  >
                    {count ?? "—"}
                  </Typography>
                </Box>
              );
            })}
          </Paper>
        ))}
      </Box>
    </Stack>
  );
}
