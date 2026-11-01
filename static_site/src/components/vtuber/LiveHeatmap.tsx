import { Box, Stack, Tooltip, Typography } from "@mui/material";

import { liveHeatmap } from "@/components/vtuber/liveHistory.ts";
import { StatCard, StatEmpty } from "@/components/vtuber/StatCard.tsx";
import type { VtuberLiveHistoryItem } from "@/types/vtubers.ts";

const WEEKDAYS = "一二三四五六日";
const HOURS = Array.from({ length: 24 }, (_, h) => h);
// 有播的格子最淡也要看得出來，跟沒播的灰底分開
const MIN_OPACITY = 0.15;

/** 統計分頁「直播時段」：星期 × 小時（台北時間），顏色越深＝這個時段累計播越久 */
export function LiveHeatmap({ lives }: { lives: VtuberLiveHistoryItem[] }) {
  const grid = liveHeatmap(lives);
  const max = Math.max(1e-9, ...grid.flat().map((c) => c.hours));

  return (
    <StatCard label={"直播時段（台北時間）"}>
      {lives.length > 0 ? (
        <>
          <Box
            sx={{
              display: "grid",
              // minmax(0, 1fr)：手機寬度下格子要能縮，不然會撐破版面
              gridTemplateColumns: "22px repeat(24, minmax(0, 1fr))",
              gap: "2px",
              mt: 1.25,
              mb: 0.75,
              fontSize: 10.5,
              color: "text.secondary",
            }}
          >
            <Box />
            {HOURS.map((h) => (
              <Box key={h} sx={{ textAlign: "center" }}>
                {h % 3 === 0 ? h : ""}
              </Box>
            ))}
            {grid.map((row, d) => [
              <Box key={`d${d}`} sx={{ display: "flex", alignItems: "center" }}>
                {WEEKDAYS[d]}
              </Box>,
              ...row.map((cell, h) => (
                <Tooltip
                  key={`${d}-${h}`}
                  disableInteractive
                  title={
                    cell.lives > 0
                      ? `週${WEEKDAYS[d]} ${h}:00–${h + 1}:00・${cell.hours.toFixed(1)} 小時・${cell.lives} 場`
                      : ""
                  }
                >
                  <Box
                    sx={{
                      aspectRatio: "1",
                      borderRadius: "2px",
                      bgcolor: cell.lives > 0 ? "primary.main" : "action.hover",
                      opacity:
                        cell.lives > 0
                          ? MIN_OPACITY + (1 - MIN_OPACITY) * (cell.hours / max)
                          : 1,
                    }}
                  />
                </Tooltip>
              )),
            ])}
          </Box>
          <Stack
            direction={"row"}
            spacing={0.5}
            alignItems={"center"}
            justifyContent={"flex-end"}
            sx={{ pb: 0.75 }}
          >
            <Typography variant={"caption"} color={"text.secondary"}>
              少
            </Typography>
            {[0.2, 0.5, 0.8, 1].map((opacity) => (
              <Box
                key={opacity}
                sx={{
                  width: 12,
                  height: 12,
                  borderRadius: "2px",
                  bgcolor: "primary.main",
                  opacity,
                }}
              />
            ))}
            <Typography variant={"caption"} color={"text.secondary"}>
              多
            </Typography>
          </Stack>
        </>
      ) : (
        <StatEmpty>沒有直播</StatEmpty>
      )}
    </StatCard>
  );
}
