import { Link as RouterLink } from "react-router-dom";
import { Box, Skeleton, Typography } from "@mui/material";

import { useAVActressSearch } from "@/apis/av/actress_search.ts";
import { ActressPhoto } from "@/components/av/actress_photo.tsx";
import { actressPagePath } from "@/helpers/avActressRef.ts";
import { joyuPath } from "@/helpers/joyu.ts";

import { ErrorSnack } from "./ErrorSnack.tsx";
import { HomeSection } from "./HomeSection.tsx";

// 首頁只放前幾位，其餘點「看全部」到女優搜尋（當月壽星）；一屏版放在 PC 右欄，只列 6 位
const BIRTHDAY_LIMIT = 16;
const COMPACT_LIMIT = 6;

/**
 * 首頁「近期生日」：今天到月底生日的女優，依日期排，今天生日的加粉紅外框。
 * compact：一屏版首頁用，PC 是條列（頭像＋名字＋日期，放右欄），手機是一排可橫向滑動的頭像
 */
export function BirthdaySection({ compact }: { compact?: boolean }) {
  const now = new Date();
  const month = now.getMonth() + 1;
  const today = now.getDate();
  const q = useAVActressSearch({
    page: 1,
    birth_month: month,
    birth_day: today,
  });
  const items = (q.data?.data?.data ?? []).slice(
    0,
    compact ? COMPACT_LIMIT : BIRTHDAY_LIMIT,
  );
  if (q.isSuccess && items.length === 0) return null;

  return (
    <HomeSection
      dense={compact}
      title="近期生日"
      note={`${month}/${today} 到月底`}
      moreTo={joyuPath(`actress?birth_month=${month}`)}
      moreLabel={`${month} 月壽星`}
    >
      {compact ? (
        <Box
          sx={{
            display: "flex",
            flexDirection: { xs: "row", md: "column" },
            gap: { xs: 1.25, md: 0.75 },
            overflowX: { xs: "auto", md: "visible" },
            pb: { xs: 0.5, md: 0 },
          }}
        >
          {q.isPending
            ? Array.from({ length: COMPACT_LIMIT }, (_, i) => (
                <Skeleton key={i} variant="rounded" height={44} />
              ))
            : items.map((a) => {
                const isToday = a.birth_day === today;
                return (
                  <Box
                    component={RouterLink}
                    key={`${a.domain}-${a.aid}`}
                    sx={{
                      alignItems: "center",
                      color: "inherit",
                      display: "flex",
                      flex: { xs: "0 0 54px", md: "none" },
                      flexDirection: { xs: "column", md: "row" },
                      gap: { xs: 0.5, md: 1.25 },
                      textAlign: { xs: "center", md: "left" },
                      textDecoration: "none",
                    }}
                    to={actressPagePath(a.name, a)}
                  >
                    <ActressPhoto
                      alt={a.name}
                      loading="lazy"
                      src={a.photo}
                      sx={{
                        aspectRatio: "1",
                        border: "2px solid",
                        borderColor: isToday ? "primary.main" : "divider",
                        borderRadius: "50%",
                        flexShrink: 0,
                        objectPosition: "top",
                        width: 40,
                      }}
                    />
                    <Typography
                      noWrap
                      sx={{
                        flex: { md: 1 },
                        fontSize: { xs: 11, md: 13 },
                        fontWeight: 700,
                        maxWidth: "100%",
                      }}
                    >
                      {a.name}
                    </Typography>
                    <Typography
                      color={isToday ? "primary" : "text.secondary"}
                      sx={{ fontSize: 11, whiteSpace: "nowrap" }}
                    >
                      {isToday ? "今天" : `${month}/${a.birth_day}`}
                    </Typography>
                  </Box>
                );
              })}
        </Box>
      ) : (
        <Box
          sx={{
            display: "grid",
            gap: 1.5,
            // minmax(0, 1fr)：1fr 的下限是內容寬度，不換行的長名字會把那一欄撐寬、大頭貼跟著變大，要固定等寬
            gridTemplateColumns: {
              xs: "repeat(4, minmax(0, 1fr))",
              sm: "repeat(6, minmax(0, 1fr))",
              md: "repeat(8, minmax(0, 1fr))",
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
      )}
      <ErrorSnack open={q.isError} message="生日資料讀取失敗，請稍後再試" />
    </HomeSection>
  );
}
