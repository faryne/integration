import { formatStorytellerDate } from "@/data/storyteller.ts";
import { steamloomPath } from "@/helpers/steamloom.ts";
import { Box, Stack, Typography } from "@mui/material";
import type { Ref } from "react";
import { Link as RouterLink } from "react-router-dom";

// 跨內容類型（故事／圖像／未來新增的類型）共用的作品標頭：標題、簡介、作者、
// 最後更新時間。新增內容類型時應該一律沿用這個元件，不要各自刻一份標頭版面。
export function ContentMetaHeader({
  title,
  titleRef,
  summary,
  authorPenNames,
  updatedAt,
}: {
  title: string;
  titleRef?: Ref<HTMLHeadingElement>;
  summary?: string;
  authorPenNames?: string[];
  updatedAt: string;
}) {
  return (
    <Box>
      <Typography
        ref={titleRef}
        component="h1"
        variant="h4"
        fontWeight={800}
        sx={{ scrollMarginTop: 80 }}
      >
        {title}
      </Typography>
      {summary && (
        <Typography color="text.secondary" sx={{ mt: 1 }}>
          {summary}
        </Typography>
      )}
      <Stack
        direction="row"
        spacing={1}
        flexWrap="wrap"
        useFlexGap
        sx={{ mt: 1 }}
      >
        {authorPenNames && authorPenNames.length > 0 && (
          <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
            {authorPenNames.map((penName) => (
              <Typography
                key={penName}
                variant="caption"
                color="primary"
                component={RouterLink}
                to={steamloomPath(`user/${encodeURIComponent(penName)}`)}
                sx={{
                  textDecoration: "none",
                  "&:hover": { textDecoration: "underline" },
                }}
              >
                作者 {penName}
              </Typography>
            ))}
          </Stack>
        )}
        <Typography variant="caption" color="text.secondary">
          更新於 {formatStorytellerDate(updatedAt)}
        </Typography>
      </Stack>
    </Box>
  );
}
