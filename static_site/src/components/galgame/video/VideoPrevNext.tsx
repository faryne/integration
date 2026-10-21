import NavigateBeforeIcon from "@mui/icons-material/NavigateBefore";
import NavigateNextIcon from "@mui/icons-material/NavigateNext";
import {
  Card,
  CardActionArea,
  CardContent,
  Stack,
  Typography,
} from "@mui/material";
import { useTranslation } from "react-i18next";
import { Link as RouterLink } from "react-router-dom";

import { useGalgameVideoNavigation } from "@/apis/galgame/catalog.ts";
import { galgameBrandSlug, galgamePath } from "@/helpers/galgame.ts";
import type { GalgameVideo } from "@/types/galgame.ts";

// 上一則／下一則的單張卡片；沒有影片時顯示淡化的空狀態
function NavCard({
  video,
  label,
  empty,
  direction,
}: {
  video?: GalgameVideo | null;
  label: string;
  empty: string;
  direction: "previous" | "next";
}) {
  const next = direction === "next";
  return (
    <Card
      variant="outlined"
      sx={{ flex: 1, minWidth: 0, opacity: video ? 1 : 0.5 }}
    >
      <CardActionArea
        component={video ? RouterLink : "button"}
        to={
          video
            ? galgamePath(
                `${galgameBrandSlug(video.brand_public_id, video.brand_name)}/video/${video.youtube_video_id}`,
              )
            : undefined
        }
        disabled={!video}
        sx={{ height: "100%", textAlign: next ? "right" : "left" }}
      >
        <CardContent sx={{ py: 1.5 }}>
          <Stack
            direction="row"
            justifyContent={next ? "flex-end" : "flex-start"}
            alignItems="center"
            spacing={0.5}
            color="text.secondary"
          >
            {!next && <NavigateBeforeIcon fontSize="small" />}
            <Typography variant="caption" fontWeight={700}>
              {label}
            </Typography>
            {next && <NavigateNextIcon fontSize="small" />}
          </Stack>
          <Typography
            variant="body2"
            fontWeight={700}
            sx={{
              mt: 0.5,
              display: "-webkit-box",
              overflow: "hidden",
              WebkitBoxOrient: "vertical",
              WebkitLineClamp: 2,
            }}
          >
            {video?.title ?? empty}
          </Typography>
        </CardContent>
      </CardActionArea>
    </Card>
  );
}

/** 同品牌的上一則／下一則影片 */
export function VideoPrevNext({
  brandSlug,
  videoId,
}: {
  brandSlug?: string;
  videoId?: string;
}) {
  const { t } = useTranslation();
  const navigation = useGalgameVideoNavigation(brandSlug, videoId);
  return (
    <Stack direction={{ xs: "column", sm: "row" }} spacing={2} sx={{ mt: 3 }}>
      <NavCard
        direction="previous"
        video={navigation.data?.previous}
        label={t("galgame.video.previous")}
        empty={t("galgame.video.noPrevious")}
      />
      <NavCard
        direction="next"
        video={navigation.data?.next}
        label={t("galgame.video.next")}
        empty={t("galgame.video.noNext")}
      />
    </Stack>
  );
}
