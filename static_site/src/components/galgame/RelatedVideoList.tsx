import { Stack, Typography } from "@mui/material";
import { useTranslation } from "react-i18next";

import { GalgameState } from "@/components/galgame/GalgameState.tsx";
import { GalgameVideoCard } from "@/components/galgame/GalgameVideoCard.tsx";
import { galgameWorkTitle } from "@/helpers/galgame.ts";
import type { GalgameVideo } from "@/types/galgame.ts";

// 側欄的一個區塊：標題（＋可選小字）與橫式小卡
function Section({
  title,
  caption,
  videos,
}: {
  title: string;
  caption?: string;
  videos: GalgameVideo[];
}) {
  return (
    <Stack spacing={1.25}>
      <div>
        <Typography variant="h6" component="h2" fontWeight={700}>
          {title}
        </Typography>
        {caption && (
          <Typography variant="caption" color="text.secondary">
            {caption}
          </Typography>
        )}
      </div>
      {videos.map((video) => (
        <GalgameVideoCard
          key={video.youtube_video_id}
          video={video}
          variant="simple"
        />
      ))}
    </Stack>
  );
}

/**
 * 影片頁側欄：先列「同一作品的其他影片」（同品牌且標題推測出的作品名相同），
 * 其餘才是一般相關影片。作品名靠標題前綴判斷，只影響排序分組。
 */
export function RelatedVideoList({
  video,
  error,
  loading,
  videos,
}: {
  video: GalgameVideo;
  error: boolean;
  loading: boolean;
  videos: GalgameVideo[];
}) {
  const { t } = useTranslation();
  if (loading) {
    return <GalgameState loading message={t("galgame.related.loading")} />;
  }
  if (error) {
    return (
      <GalgameState severity="error" message={t("galgame.related.error")} />
    );
  }

  const work = galgameWorkTitle(video.title);
  const sameWork = work
    ? videos.filter(
        (item) =>
          item.brand_public_id === video.brand_public_id &&
          galgameWorkTitle(item.title) === work,
      )
    : [];
  const others = videos.filter((item) => !sameWork.includes(item));

  return (
    <Stack spacing={3}>
      {sameWork.length > 0 && (
        <Section
          title={t("galgame.related.sameWork")}
          caption={work}
          videos={sameWork}
        />
      )}
      {others.length > 0 ? (
        <Section title={t("galgame.related.heading")} videos={others} />
      ) : (
        sameWork.length === 0 && (
          <GalgameState message={t("galgame.related.empty")} />
        )
      )}
    </Stack>
  );
}
