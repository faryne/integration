import type { Video } from "@/types/av.ts";
import { Button, Chip, Stack, Typography, Box, Skeleton } from "@mui/material";
import { Link as RouterLink } from "react-router-dom";
import OpenInNewIcon from "@mui/icons-material/OpenInNew";
import PlayCircleOutlineIcon from "@mui/icons-material/PlayCircleOutline";
import EditOutlinedIcon from "@mui/icons-material/EditOutlined";
import type { VideoSyncResult } from "@/apis/av/video_sync.ts";
import { VideoDetailTabs } from "@/components/av/video_detail_tabs.tsx";
import { VideoSyncButton } from "@/components/av/video_sync_button.tsx";
import { VideoCast } from "@/components/av/video_cast.tsx";
import { VideoMetaRows } from "@/components/av/video_meta_rows.tsx";
import { useBreadcrumbTail } from "@/helpers/breadcrumbTail.ts";
import { AvCoverImage } from "@/components/av/av_cover_image.tsx";
import { joyuPath } from "@/helpers/joyu.ts";

export interface IVideoDetail {
  video?: Video;
  // 「同步資料」成功取得官方番號後，由頁面確認新網址查得到資料再換頁
  onSynced?: (result: VideoSyncResult) => Promise<void>;
  // 同步確定失敗（已標成 orphan），由頁面重新查詢讓按鈕消失
  onOrphaned?: () => void;
}

export function VideoDetail(props: IVideoDetail) {
  const video = props.video || null;
  const displayMakerNo = video?.maker_no?.trim() ?? "";
  // 沒有官方番號的舊資料顯示 DMM 內部番號
  const displayCode = displayMakerNo || video?.no.toUpperCase() || "";

  useBreadcrumbTail(video ? `${displayCode} ${video.title}` : undefined);

  if (!video) {
    return (
      <Stack spacing={3}>
        <Skeleton height={360} sx={{ borderRadius: 2 }} variant="rounded" />
        <Skeleton height={42} sx={{ maxWidth: 720 }} variant="rounded" />
        <Skeleton height={160} variant="rounded" />
      </Stack>
    );
  }

  return (
    <Stack spacing={4}>
      <Box
        sx={{
          display: "grid",
          gridTemplateColumns: { xs: "1fr", md: "minmax(280px, 420px) 1fr" },
          gap: { xs: 3, md: 4 },
          alignItems: "stretch",
        }}
      >
        {/* 封面是直式（約 1429×1944），照原比例顯示不裁切；手機限制高度並置中 */}
        <Box
          sx={{
            alignSelf: "start",
            borderRadius: 2,
            overflow: "hidden",
            bgcolor: "grey.100",
            border: "1px solid",
            borderColor: "divider",
            boxShadow: "0 18px 50px rgba(15, 23, 42, 0.12)",
            justifySelf: { xs: "center", md: "stretch" },
            maxWidth: "100%",
          }}
        >
          <AvCoverImage
            src={video.thumb}
            alt={video.title}
            sx={{
              display: "block",
              height: "auto",
              maxHeight: { xs: "60vh", md: "none" },
              maxWidth: "100%",
              objectFit: "contain",
              width: { xs: "auto", md: "100%" },
            }}
          />
        </Box>

        <Stack
          justifyContent="space-between"
          spacing={3}
          sx={{
            borderTop: "1px solid",
            borderBottom: "1px solid",
            borderColor: "divider",
            py: { xs: 2.5, md: 3.5 },
          }}
        >
          <Stack spacing={2}>
            <Stack direction="row" flexWrap="wrap" gap={1}>
              {displayCode && (
                <Chip
                  label={displayCode}
                  size="small"
                  sx={{
                    borderRadius: 1,
                    fontWeight: 700,
                    letterSpacing: 0,
                  }}
                />
              )}
              {[
                video.vod_date && `配信日 ${video.vod_date}`,
                video.publish_date && `發售日 ${video.publish_date}`,
                video.duration ? `${video.duration} 分鐘` : "",
              ]
                .filter(Boolean)
                .map((label) => (
                  <Chip
                    key={label}
                    label={label}
                    size="small"
                    sx={{ borderRadius: 1 }}
                    variant="outlined"
                  />
                ))}
            </Stack>

            <Typography
              component="h1"
              sx={{
                fontSize: { xs: "1.25rem", md: "1.75rem" },
                fontWeight: 800,
                letterSpacing: 0,
                lineHeight: 1.2,
                textAlign: "left",
              }}
              variant="h3"
            >
              {video.title}
            </Typography>
            <VideoCast
              actresses={video.actresses}
              actressIds={video.actress_ids}
            />
            <VideoMetaRows video={video} />
          </Stack>

          <Stack direction="row" flexWrap="wrap" gap={1}>
            {video.maker_no ? (
              <Button
                endIcon={<OpenInNewIcon />}
                onClick={() =>
                  window.open(
                    `https://missav.ws/${video.maker_no}`,
                    "_blank",
                    "noopener,noreferrer",
                  )
                }
                startIcon={<PlayCircleOutlineIcon />}
                sx={{ borderRadius: 1.5, px: 2 }}
                variant="contained"
              >
                MissAV
              </Button>
            ) : (
              <VideoSyncButton
                no={video.no}
                orphan={!!video.is_orphan}
                onOrphaned={() => props.onOrphaned?.()}
                onSynced={async (r) => props.onSynced?.(r)}
              />
            )}
            {/* 送出修改等管理者審核；orphan 片也可以，官方番號正是靠這裡補 */}
            <Button
              component={RouterLink}
              startIcon={<EditOutlinedIcon />}
              sx={{ borderRadius: 1.5, px: 2 }}
              to={joyuPath(
                `video/${encodeURIComponent(video.maker_no?.trim() || video.no)}/edit`,
              )}
              variant="outlined"
            >
              修改資料
            </Button>
          </Stack>
        </Stack>
      </Box>

      {/* 圖片預覽與相關作品用 tab 切換（有圖片時預設停在圖片預覽）；key 讓換片時回到第一個 tab */}
      <VideoDetailTabs key={video.no} video={video} />
    </Stack>
  );
}
