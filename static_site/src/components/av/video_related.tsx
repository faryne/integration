import type { Video } from "@/types/av.ts";
import { Stack, Typography } from "@mui/material";
import { useAVVideoSearch } from "@/apis/av/video_search.ts";
import type { VideoSearchRequest } from "@/apis/av/video_search.ts";
import { VideoCoverCard } from "@/components/av/video_cover_card.tsx";

const RELATED_LIMIT = 12;

/** 詳細頁下方的相關作品：同系列、同女優（各取第一個）。查詢失敗或沒有結果就整區不顯示 */
export function VideoRelated({ video }: { video: Video }) {
  const series = video.series.find((s) => s !== "");
  const actress = video.actresses.find((a) => a !== "");
  return (
    <>
      {series && (
        <RelatedRow current={video} filter={{ series }} title="同系列作品" />
      )}
      {actress && (
        <RelatedRow
          current={video}
          filter={{ actress }}
          title={`${actress} 的其他作品`}
        />
      )}
    </>
  );
}

function RelatedRow({
  current,
  filter,
  title,
}: {
  current: Video;
  filter: Partial<VideoSearchRequest>;
  title: string;
}) {
  const result = useAVVideoSearch({ page: 1, ...filter });
  // 排除目前這部；新舊資料的 no 大小寫不一，比對時一律轉小寫
  const videos = (result.data?.data?.data ?? [])
    .filter((v) => v.no.toLowerCase() !== current.no.toLowerCase())
    .slice(0, RELATED_LIMIT);
  if (videos.length === 0) return null;

  return (
    <Stack spacing={1.5} sx={{ textAlign: "left" }}>
      <Typography
        component="h2"
        sx={{ fontWeight: 800, letterSpacing: 0 }}
        variant="h6"
      >
        {title}
      </Typography>
      <Stack direction="row" spacing={1.5} sx={{ overflowX: "auto", pb: 1 }}>
        {videos.map((v) => (
          <VideoCoverCard key={v.no} video={v} />
        ))}
      </Stack>
    </Stack>
  );
}
