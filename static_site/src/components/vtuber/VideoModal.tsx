import { Box, Button, Dialog, Stack, Typography } from "@mui/material";
import OpenInNewIcon from "@mui/icons-material/OpenInNew";

import { youtubeWatchUrl } from "@/components/vtuber/format.ts";
import { ChannelAvatar } from "@/components/vtuber/ChannelAvatar.tsx";
import type { VtuberPlayingVideo } from "@/types/vtubers.ts";

interface VideoModalProps {
  video: VtuberPlayingVideo | null;
  onClose: () => void;
}

/** 點直播或影片開的 modal：直接嵌入 YouTube 播放 */
export function VideoModal({ video, onClose }: VideoModalProps) {
  return (
    <Dialog open={Boolean(video)} onClose={onClose} maxWidth={"md"} fullWidth>
      {video && (
        <>
          <Box sx={{ aspectRatio: "16 / 9", bgcolor: "common.black" }}>
            <Box
              component={"iframe"}
              src={`https://www.youtube.com/embed/${video.videoId}?autoplay=1`}
              title={video.title}
              allow={
                "accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              }
              allowFullScreen
              sx={{ width: "100%", height: "100%", border: 0 }}
            />
          </Box>
          <Stack
            direction={"row"}
            spacing={1.5}
            useFlexGap
            sx={{ p: 2, flexWrap: { xs: "wrap", sm: "nowrap" } }}
          >
            <ChannelAvatar src={video.channelThumbnailUrl} />
            <Box sx={{ minWidth: 0, flex: 1 }}>
              <Typography fontWeight={700} sx={{ lineHeight: 1.45 }}>
                {video.title}
              </Typography>
              <Typography variant={"body2"} color={"text.secondary"}>
                {video.channelTitle}・{video.meta}
              </Typography>
            </Box>
            <Stack
              direction={"row"}
              spacing={1}
              sx={{ flexShrink: 0, ml: "auto", alignSelf: "flex-start" }}
            >
              <Button
                size={"small"}
                variant={"outlined"}
                startIcon={<OpenInNewIcon />}
                href={youtubeWatchUrl(video.videoId)}
                target={"_blank"}
                rel={"noopener"}
              >
                YouTube
              </Button>
              <Button size={"small"} variant={"outlined"} onClick={onClose}>
                關閉
              </Button>
            </Stack>
          </Stack>
        </>
      )}
    </Dialog>
  );
}
