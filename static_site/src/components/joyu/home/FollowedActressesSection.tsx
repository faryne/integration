import { Box } from "@mui/material";

import { useJoyuFeed } from "@/apis/av/joyu_me.ts";
import { VideoCoverCard } from "@/components/av/video_cover_card.tsx";
import { useJoyuAuth } from "@/components/joyu/auth/JoyuAuthContext.ts";
import { joyuPath } from "@/helpers/joyu.ts";
import type { Video } from "@/types/av.ts";

import { HomeSection } from "./HomeSection.tsx";

// 首頁只放一排
const LIMIT = 6;

/**
 * 首頁最上面「你追蹤的女優新片」：最近 7 天、只取女優類型的追蹤（標籤這類量大的條件不放首頁），
 * 把各女優的新片合在一起依配信日排、同一部只留一次。沒有追蹤女優或這週都沒新片就不顯示
 */
export function FollowedActressesSection() {
  const { user } = useJoyuAuth();
  const feed = useJoyuFeed(user?.uid, 7);
  const seen = new Set<string>();
  const videos = (feed.data?.sections ?? [])
    .filter((s) => s.kind === "actress")
    .flatMap((s) => s.videos)
    .filter((v: Video) => !seen.has(v.no) && !!seen.add(v.no))
    .sort((a, b) => b.vod_date.localeCompare(a.vod_date))
    .slice(0, LIMIT);
  if (videos.length === 0) return null;

  return (
    <HomeSection
      title="你追蹤的女優新片"
      note="最近 7 天"
      moreTo={joyuPath("me/follows?kind=actress&days=7")}
      moreLabel="我的追蹤"
    >
      <Box
        sx={{
          display: "grid",
          gap: 1.5,
          gridTemplateColumns: {
            xs: "repeat(2, minmax(0, 1fr))",
            sm: "repeat(3, minmax(0, 1fr))",
            md: "repeat(6, minmax(0, 1fr))",
          },
        }}
      >
        {videos.map((v) => (
          <VideoCoverCard key={v.no} video={v} />
        ))}
      </Box>
    </HomeSection>
  );
}
