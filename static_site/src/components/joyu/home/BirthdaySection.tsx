import { Link as RouterLink } from "react-router-dom";
import { Box, Skeleton, Typography } from "@mui/material";

import { useAVActressSearch } from "@/apis/av/actress_search.ts";
import { ActressPhoto } from "@/components/av/actress_photo.tsx";
import { actressPagePath } from "@/helpers/avActressRef.ts";
import { joyuPath } from "@/helpers/joyu.ts";

import { ErrorSnack } from "./ErrorSnack.tsx";
import { HomeSection } from "./HomeSection.tsx";

// 首頁只放前幾位，其餘點「看全部」到女優搜尋（當月壽星）
const BIRTHDAY_LIMIT = 16;

/** 首頁「近期生日」：今天到月底生日的女優，依日期排，今天生日的加粉紅外框 */
export function BirthdaySection() {
  const now = new Date();
  const month = now.getMonth() + 1;
  const today = now.getDate();
  const q = useAVActressSearch({
    page: 1,
    birth_month: month,
    birth_day: today,
  });
  const items = (q.data?.data?.data ?? []).slice(0, BIRTHDAY_LIMIT);
  if (q.isSuccess && items.length === 0) return null;

  return (
    <HomeSection
      title="近期生日"
      note={`${month}/${today} 到月底`}
      moreTo={joyuPath(`actress?birth_month=${month}`)}
      moreLabel={`${month} 月壽星`}
    >
      <Box
        sx={{
          display: "grid",
          gap: 1.5,
          gridTemplateColumns: {
            xs: "repeat(4, 1fr)",
            sm: "repeat(6, 1fr)",
            md: "repeat(8, 1fr)",
          },
        }}
      >
        {q.isPending
          ? Array.from({ length: 8 }, (_, i) => (
              <Skeleton
                key={i}
                variant="circular"
                sx={{ width: "100%", height: "auto", aspectRatio: "1" }}
              />
            ))
          : items.map((a) => {
              const isToday = a.birth_day === today;
              return (
                <Box
                  key={`${a.domain}-${a.aid}`}
                  component={RouterLink}
                  to={actressPagePath(a.name, a)}
                  sx={{
                    color: "inherit",
                    textAlign: "center",
                    textDecoration: "none",
                  }}
                >
                  <ActressPhoto
                    src={a.photo}
                    alt={a.name}
                    loading="lazy"
                    sx={{
                      width: "100%",
                      aspectRatio: "1",
                      borderRadius: "50%",
                      border: "2px solid",
                      borderColor: isToday ? "primary.main" : "divider",
                      objectPosition: "top",
                    }}
                  />
                  <Typography
                    noWrap
                    sx={{ fontSize: 13, fontWeight: 700, mt: 0.75 }}
                  >
                    {a.name}
                  </Typography>
                  <Typography color="text.secondary" sx={{ fontSize: 12 }}>
                    {month}/{a.birth_day}
                    {isToday && "・今天"}
                  </Typography>
                </Box>
              );
            })}
      </Box>
      <ErrorSnack open={q.isError} message="生日資料讀取失敗，請稍後再試" />
    </HomeSection>
  );
}
