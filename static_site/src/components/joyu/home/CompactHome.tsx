import type { ReactNode } from "react";
import { Box, Stack, Typography, useMediaQuery, useTheme } from "@mui/material";

import { JoyuAdSlot } from "@/components/joyu/promo/JoyuAdSlot.tsx";

import { BirthdaySection } from "./BirthdaySection.tsx";
import { NewActressesSection } from "./NewActressesSection.tsx";
import { NewVideosSection } from "./NewVideosSection.tsx";
import { TopicsSection } from "./TopicsSection.tsx";

// 只給螢幕閱讀器與搜尋引擎看（畫面上不佔位）
const visuallyHidden = {
  border: 0,
  clip: "rect(0 0 0 0)",
  height: "1px",
  margin: "-1px",
  overflow: "hidden",
  padding: 0,
  position: "absolute",
  whiteSpace: "nowrap",
  width: "1px",
} as const;

/**
 * 一屏版首頁：主要區塊不用捲動就看得到（1366×768 筆電、iPhone 可視範圍）。
 * PC：頂端右側版面切換＋左欄（今天有新片的女優、新片、728 版位）＋右欄 320（近期生日、女優主題、300×100 版位）。
 * 手機：單欄，每區一排橫向滑動，版位放最後。「你追蹤的女優新片」併進新片區塊的第一個分頁。
 * 搜尋與主題捷徑交給頁首（JoyuHeader 的搜尋框＋JoyuHeaderTopics），這裡不再放 Hero Card。
 * switcher：版面切換＋評分；PC 放右上角，手機放最下面（放上面會把女優主題擠出第一屏）
 */
export function CompactHome({ switcher }: { switcher: ReactNode }) {
  const desktop = useMediaQuery(useTheme().breakpoints.up("md"));
  return (
    <>
      {/* 這個版面沒有標題字，補一個只給螢幕閱讀器與搜尋引擎看的 h1；放在 Stack 外，免得 spacing 多推一段 */}
      <Typography component="h1" sx={visuallyHidden}>
        找女優、查番號
      </Typography>
      <Stack spacing={{ xs: 1, md: 1.5 }}>
        {desktop && (
          <Box sx={{ display: "flex", justifyContent: "flex-end" }}>
            {switcher}
          </Box>
        )}
        <Box
          sx={{
            alignItems: "start",
            display: "grid",
            gap: { xs: 1, md: 2.5 },
            gridTemplateColumns: {
              xs: "minmax(0, 1fr)",
              md: "minmax(0, 1fr) 320px",
            },
          }}
        >
          <Stack spacing={{ xs: 1, md: 1.5 }} sx={{ minWidth: 0 }}>
            <NewActressesSection compact />
            <NewVideosSection compact />
            {/* 728 版位只在 PC 左欄；手機不渲染（用 display:none 藏起來還是會在背景載廣告、算成無效曝光） */}
            {desktop && <JoyuAdSlot placement="home-1" size="desktop" />}
          </Stack>
          <Stack spacing={{ xs: 1, md: 2 }} sx={{ minWidth: 0 }}>
            <BirthdaySection compact />
            <TopicsSection compact />
            <JoyuAdSlot placement="home-2" size="mobile" />
          </Stack>
        </Box>
        {!desktop && switcher}
      </Stack>
    </>
  );
}
