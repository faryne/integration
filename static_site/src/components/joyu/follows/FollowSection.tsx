import { Link as RouterLink } from "react-router-dom";
import { Box, Chip, Link, Stack, Typography } from "@mui/material";

import type { JoyuFeedSection } from "@/apis/av/joyu_me.ts";
import { VideoCoverCard } from "@/components/av/video_cover_card.tsx";
import { FollowButton } from "@/components/joyu/FollowButton.tsx";
import { joyuPath } from "@/helpers/joyu.ts";

import { FOLLOW_KIND_LABELS, followItemLink } from "./followKinds.ts";

// 每個追蹤最多放幾部（後端也是回這麼多），更多的到搜尋頁看
const PER_SECTION = 6;

/**
 * 我的追蹤頁的一區：類型＋名稱＋愛心（取消追蹤）＋部數，下面是同一列的預約作品（標「即將發售」、排前面）與最近的新片。
 * 新片超過 6 部時連到搜尋頁看全部；一列超過 6 部時改成可以左右滑動（carousel），不另外開一列
 */
export function FollowSection({
  section,
  since,
}: {
  section: JoyuFeedSection;
  since: string;
}) {
  // 預約作品排前面（配信日近的在前），接著是新片（新的在前）
  const videos = [...(section.upcoming ?? []), ...section.videos];
  const carousel = videos.length > PER_SECTION;
  return (
    <Box component="section" sx={{ textAlign: "left" }}>
      <Stack
        direction="row"
        flexWrap="wrap"
        gap={1}
        sx={{ alignItems: "center", mb: 1.25 }}
        useFlexGap
      >
        <Chip
          label={FOLLOW_KIND_LABELS[section.kind]}
          size="small"
          variant="outlined"
        />
        <Link
          color="inherit"
          component={RouterLink}
          sx={{ fontSize: 16, fontWeight: 800 }}
          to={followItemLink(section)}
          underline="hover"
        >
          {section.label}
        </Link>
        <FollowButton
          kind={section.kind}
          label={section.label}
          value={section.value}
        />
        <Typography color="primary" sx={{ fontSize: 13, fontWeight: 700 }}>
          {[
            section.count > 0 && `${section.count} 部新片`,
            section.upcoming_count > 0 &&
              `${section.count > 0 ? "＋" : ""}${section.upcoming_count} 部即將發售`,
          ]
            .filter(Boolean)
            .join("")}
        </Typography>
        {section.count > PER_SECTION && (
          <Link
            component={RouterLink}
            sx={{ fontSize: 13, ml: "auto" }}
            to={joyuPath(`video?${section.search_query}&start_date=${since}`)}
            underline="hover"
          >
            到搜尋頁看全部 →
          </Link>
        )}
      </Stack>
      <Box
        sx={
          carousel
            ? {
                display: "flex",
                gap: 1.5,
                overflowX: "auto",
                pb: 1,
                scrollSnapType: "x mandatory",
                "& > *": {
                  flex: { xs: "0 0 120px", md: "0 0 calc((100% - 60px) / 6)" },
                  scrollSnapAlign: "start",
                },
              }
            : {
                display: { xs: "flex", md: "grid" },
                gap: 1.5,
                gridTemplateColumns: "repeat(6, minmax(0, 1fr))",
                overflowX: { xs: "auto", md: "visible" },
                pb: { xs: 1, md: 0 },
                "& > *": { flex: { xs: "0 0 120px", md: "initial" } },
              }
        }
      >
        {videos.map((v) => (
          <VideoCoverCard key={v.no} video={v} />
        ))}
      </Box>
    </Box>
  );
}
