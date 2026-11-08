import type { ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { Box, Chip, Stack, Typography } from "@mui/material";

import type { FollowKind } from "@/apis/av/joyu_me.ts";
import { ActressLinks } from "@/components/av/actress_links.tsx";
import { FollowButton } from "@/components/joyu/FollowButton.tsx";
import { joyuPath } from "@/helpers/joyu.ts";
import type { Video } from "@/types/av.ts";

const clean = (items?: unknown[]) =>
  (items ?? []).map((v) => String(v ?? "").trim()).filter(Boolean);

/**
 * 影片頁標題下方的資料列（取代原本「基本資料」分頁的表格）：發售商、品牌、系列、監督、標籤各一列，沒資料的整列不顯示。
 * 值點了進影片搜尋（精確篩選，參數名稱同 data/avVideoFilters.ts），後面的愛心是追蹤；最後一列是核准過的參考連結
 */
export function VideoMetaRows({ video }: { video: Video }) {
  const navigate = useNavigate();
  const all: { label: string; kind: FollowKind; items: string[] }[] = [
    { label: "發售商", kind: "maker", items: clean(video.makers) },
    { label: "品牌", kind: "label", items: clean(video.labels) },
    { label: "系列", kind: "series", items: clean(video.series) },
    { label: "監督", kind: "director", items: clean(video.directors) },
    { label: "標籤", kind: "tag", items: clean(video.tags) },
  ];
  const rows = all.filter((r) => r.items.length > 0);

  const row = (label: string, content: ReactNode) => (
    <Box
      key={label}
      sx={{
        alignItems: "center",
        display: "grid",
        gap: 1,
        gridTemplateColumns: "56px 1fr",
      }}
    >
      <Typography color="text.secondary" sx={{ fontSize: 12 }}>
        {label}
      </Typography>
      {content}
    </Box>
  );

  return (
    <Stack spacing={1} sx={{ textAlign: "left" }}>
      {rows.map((r) =>
        row(
          r.label,
          <Stack direction="row" flexWrap="wrap" gap={0.75} useFlexGap>
            {r.items.map((v) => (
              <Chip
                key={v}
                clickable
                label={
                  <Box
                    component="span"
                    sx={{
                      alignItems: "center",
                      display: "inline-flex",
                      gap: 0.25,
                    }}
                  >
                    {v}
                    <FollowButton kind={r.kind} label={v} value={v} />
                  </Box>
                }
                onClick={() =>
                  navigate(joyuPath(`video?${r.kind}=${encodeURIComponent(v)}`))
                }
                size="small"
                sx={{ pr: 0.25 }}
                variant="outlined"
              />
            ))}
          </Stack>,
        ),
      )}
      {video.links?.length
        ? row("連結", <ActressLinks links={video.links} />)
        : null}
    </Stack>
  );
}
