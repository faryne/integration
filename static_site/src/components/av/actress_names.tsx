import { Chip, Stack } from "@mui/material";
import { Link as RouterLink } from "react-router-dom";
import type { Actress } from "@/types/av.ts";
import { actressPagePath } from "@/helpers/avActressRef.ts";

/**
 * 女優頁的「名義」：本名＋別名，目前這頁的那個反白。
 * 點了換到該名義的網址（帶這位自己的參數），資料卡不變、出演影片換成那個名義的作品；沒有別名不顯示
 */
export function ActressNames({
  actress,
  current,
}: {
  actress: Actress;
  current: string;
}) {
  const aliases = actress.aliases ?? [];
  if (aliases.length === 0) return null;

  return (
    <Stack direction="row" flexWrap="wrap" gap={0.75} justifyContent="center">
      {[actress.name, ...aliases].map((name) => (
        <Chip
          clickable
          color={name === current ? "primary" : "default"}
          component={RouterLink}
          key={name}
          label={name}
          size="small"
          sx={{ fontWeight: 700 }}
          to={actressPagePath(name, actress)}
          variant={name === current ? "filled" : "outlined"}
        />
      ))}
    </Stack>
  );
}
