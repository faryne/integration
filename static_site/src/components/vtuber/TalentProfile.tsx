import { Box, Button, Paper, Stack, Typography } from "@mui/material";
import OpenInNewIcon from "@mui/icons-material/OpenInNew";
import { useState } from "react";

import { CalendarSubscribeMenu } from "@/components/vtuber/CalendarSubscribeMenu.tsx";
import {
  formatCount,
  GRADUATED_RING,
  formatSignedCount,
  taipeiTime,
} from "@/components/vtuber/format.ts";
import { ChannelAvatar } from "@/components/vtuber/ChannelAvatar.tsx";
import type { VtuberChannelDetail } from "@/types/vtubers.ts";

interface TalentProfileProps {
  channel: VtuberChannelDetail;
  onCopied: (ok: boolean) => void;
}

/** 藝人頁左側：橫幅、頭像、頻道說明、數據與 7 日／90 日增減、外部連結、訂閱個人行事曆（曲線在「統計」分頁） */
export function TalentProfile({ channel, onCopied }: TalentProfileProps) {
  const [descOpen, setDescOpen] = useState(false);
  const since = channel.channel_published_at
    ? taipeiTime(channel.channel_published_at)
    : null;

  return (
    <Paper
      variant={"outlined"}
      sx={{ overflow: "hidden", position: { md: "sticky" }, top: { md: 16 } }}
    >
      {/* 橫幅跟頭像同一個圖床，要用 img 才能設 no-referrer；=w1060 是 YouTube 圖床的縮放參數 */}
      <Box
        component={channel.banner_url ? "img" : "div"}
        src={channel.banner_url ? `${channel.banner_url}=w1060` : undefined}
        alt={""}
        referrerPolicy={"no-referrer"}
        sx={{
          display: "block",
          width: "100%",
          height: 84,
          objectFit: "cover",
          bgcolor: "action.hover",
        }}
      />
      <Box sx={{ px: 2, pb: 2, mt: "-42px" }}>
        <ChannelAvatar
          src={channel.thumbnail_url}
          sx={{
            width: 84,
            height: 84,
            border: 4,
            borderColor: "background.paper",
            ...(channel.is_graduated && {
              ...GRADUATED_RING,
              outlineWidth: 2,
              outlineOffset: -2,
            }),
          }}
        />
        <Typography
          variant={"h6"}
          fontWeight={800}
          sx={{ mt: 1, lineHeight: 1.35 }}
        >
          {channel.title}
        </Typography>
        <Typography variant={"body2"} color={"text.secondary"}>
          {channel.handle}
          {channel.unit && `・${channel.unit.name}`}
        </Typography>

        {channel.description && (
          <>
            <Typography
              variant={"body2"}
              color={"text.secondary"}
              sx={{
                mt: 1.25,
                whiteSpace: "pre-line",
                lineHeight: 1.65,
                ...(!descOpen && {
                  display: "-webkit-box",
                  WebkitLineClamp: 4,
                  WebkitBoxOrient: "vertical",
                  overflow: "hidden",
                }),
              }}
            >
              {channel.description}
            </Typography>
            <Button
              size={"small"}
              onClick={() => setDescOpen(!descOpen)}
              sx={{ px: 0 }}
            >
              {descOpen ? "收合" : "顯示完整說明"}
            </Button>
          </>
        )}

        <Box
          sx={{
            display: "grid",
            gridTemplateColumns: "repeat(3, 1fr)",
            gap: 1,
            my: 1.5,
          }}
        >
          {[
            ["訂閱", formatCount(channel.subscriber_count)],
            ["觀看", formatCount(channel.view_count)],
            ["影片", channel.video_count.toLocaleString()],
          ].map(([label, value]) => (
            <Box
              key={label}
              sx={{ px: 1.25, py: 1, borderRadius: 1, bgcolor: "action.hover" }}
            >
              <Typography variant={"caption"} color={"text.secondary"}>
                {label}
              </Typography>
              <Typography fontWeight={700}>{value}</Typography>
            </Box>
          ))}
        </Box>

        <Stack direction={"row"} spacing={2}>
          <Delta label={"7 日"} value={channel.subscriber_delta_7d} />
          <Delta label={"90 日"} value={channel.subscriber_delta_90d} />
        </Stack>

        {since && (
          <Typography variant={"body2"} color={"text.secondary"} sx={{ mt: 1 }}>
            頻道建立於 {since.dateKey.replaceAll("-", "/")}
          </Typography>
        )}

        <Stack spacing={1} sx={{ mt: 1.5 }}>
          {channel.calendar && (
            <CalendarSubscribeMenu
              calendar={channel.calendar}
              label={"訂閱個人行事曆"}
              fullWidth
              onCopied={onCopied}
            />
          )}
          <Stack direction={"row"} spacing={1}>
            <Button
              fullWidth
              variant={"outlined"}
              size={"small"}
              startIcon={<OpenInNewIcon />}
              href={channel.youtube_url}
              target={"_blank"}
              rel={"noopener"}
            >
              YouTube
            </Button>
            {channel.official_url && (
              <Button
                fullWidth
                variant={"outlined"}
                size={"small"}
                startIcon={<OpenInNewIcon />}
                href={channel.official_url}
                target={"_blank"}
                rel={"noopener"}
              >
                官網
              </Button>
            )}
          </Stack>
        </Stack>
      </Box>
    </Paper>
  );
}

function Delta({ label, value }: { label: string; value: number | null }) {
  return (
    <Typography variant={"body2"} color={"text.secondary"}>
      {label}{" "}
      {value == null ? (
        "—"
      ) : (
        <Box
          component={"b"}
          sx={{ color: value >= 0 ? "success.main" : "warning.main" }}
        >
          {formatSignedCount(value)}
        </Box>
      )}
    </Typography>
  );
}
