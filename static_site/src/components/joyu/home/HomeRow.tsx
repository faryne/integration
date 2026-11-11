import type { ReactNode } from "react";
import { Box } from "@mui/material";

/** 一屏版首頁的橫向滑動列：只放一排，超出的往右滑；item 是每個卡片的固定寬度（可依斷點給不同值） */
export function HomeRow({
  item,
  children,
}: {
  item: { xs: number; md: number };
  children: ReactNode;
}) {
  return (
    <Box
      sx={{
        display: "flex",
        gap: { xs: 1, md: 1.25 },
        overflowX: "auto",
        pb: 0.5,
        scrollbarWidth: "thin",
        "& > *": { flex: { xs: `0 0 ${item.xs}px`, md: `0 0 ${item.md}px` } },
      }}
    >
      {children}
    </Box>
  );
}
