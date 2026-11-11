import { Box } from "@mui/material";

import { VideoCoverCard } from "@/components/av/video_cover_card.tsx";
import { joyuPath } from "@/helpers/joyu.ts";

import { HomeSection } from "./HomeSection.tsx";
import {
  FOLLOWED_DAYS,
  useFollowedActressVideos,
} from "./useFollowedActressVideos.ts";

// 首頁只放一排
const LIMIT = 6;

/**
 * 原版面首頁最上面「你追蹤的女優新片」（一屏版改成「新片」區塊的第一個分頁）。
 * 沒有追蹤女優或這週都沒新片就不顯示
 */
export function FollowedActressesSection() {
  const { videos } = useFollowedActressVideos(LIMIT);
  if (videos.length === 0) return null;

  return (
    <HomeSection
      title="你追蹤的女優新片"
      note={`最近 ${FOLLOWED_DAYS} 天`}
      moreTo={joyuPath(`me/follows?kind=actress&days=${FOLLOWED_DAYS}`)}
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
