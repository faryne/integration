import { Box, Card, CardContent, Stack, Typography } from "@mui/material";
import { Link as RouterLink } from "react-router-dom";
import { ActressPhoto } from "@/components/av/actress_photo.tsx";
import { actressPagePath } from "@/helpers/avActressRef.ts";
import type { Actress } from "@/types/av.ts";

// 同名的人靠出生年／罩杯／身高分辨，沒資料的項目不顯示
const summary = (a: Actress) =>
  [
    a.birth_year > 0 && `${a.birth_year} 年生`,
    a.cup && `${a.cup} cup`,
    a.height > 0 && `${a.height}cm`,
  ]
    .filter(Boolean)
    .join("・");

const rowSx = {
  alignItems: "center",
  border: "1px solid",
  borderColor: "divider",
  borderRadius: 2,
  color: "inherit",
  display: "flex",
  gap: 1.25,
  p: 1,
  textAlign: "left",
  textDecoration: "none",
} as const;

/** 女優頁「可能同名的女優」：名字完全相同的有兩位以上才顯示，點了換到那一位的網址 */
export function ActressSameNames({
  actresses,
  current,
}: {
  actresses: Actress[];
  current: Actress;
}) {
  if (actresses.length < 2) return null;
  return (
    <Card>
      <CardContent>
        <Typography fontWeight={900} sx={{ mb: 1, textAlign: "left" }}>
          可能同名的女優
        </Typography>
        <Stack spacing={1}>
          {actresses.map((a) => {
            const selected =
              a.domain === current.domain && a.aid === current.aid;
            const body = (
              <>
                <ActressPhoto
                  alt={a.name}
                  loading="lazy"
                  src={a.photo}
                  sx={{ borderRadius: 1, flex: "0 0 auto", width: 36 }}
                />
                <Box sx={{ minWidth: 0 }}>
                  <Typography fontWeight={700} variant="body2">
                    {a.name}
                  </Typography>
                  <Typography color="text.secondary" variant="caption">
                    {summary(a)}
                  </Typography>
                </Box>
              </>
            );
            // 目前這位只標示、不做連結
            return selected ? (
              <Box
                key={`${a.domain}-${a.aid}`}
                sx={{
                  ...rowSx,
                  bgcolor: "action.selected",
                  borderColor: "primary.main",
                }}
              >
                {body}
              </Box>
            ) : (
              <Box
                component={RouterLink}
                key={`${a.domain}-${a.aid}`}
                sx={{ ...rowSx, "&:hover": { bgcolor: "action.hover" } }}
                to={actressPagePath(a.name, a)}
              >
                {body}
              </Box>
            );
          })}
        </Stack>
      </CardContent>
    </Card>
  );
}
