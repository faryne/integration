import { Box, ButtonBase, Typography } from "@mui/material";
import { Link } from "react-router-dom";

import { ChannelAvatar } from "@/components/vtuber/ChannelAvatar.tsx";
import type { VtuberChannelSummary } from "@/types/vtubers.ts";

interface TalentAvatarProps {
  channel: VtuberChannelSummary;
  size?: number;
  // 藝人頁上標出目前這位
  current?: boolean;
  showName?: boolean;
  onSelect?: () => void;
}

/** 藝人頭像按鈕：正在直播加紅框＋LIVE，目前這位用主色框；點了進藝人頁 */
export function TalentAvatar({
  channel,
  size = 48,
  current = false,
  showName = true,
  onSelect,
}: TalentAvatarProps) {
  return (
    <ButtonBase
      component={Link}
      to={`/data/vtubers/${channel.handle}`}
      onClick={onSelect}
      title={channel.title}
      sx={{
        position: "relative",
        flexDirection: "column",
        gap: 0.5,
        width: showName ? 64 : size + 6,
        borderRadius: 2,
        "&:hover .MuiAvatar-root": { transform: "scale(1.08)" },
      }}
    >
      <ChannelAvatar
        src={channel.thumbnail_url}
        alt={channel.title}
        sx={{
          width: size,
          height: size,
          transition: "transform .12s",
          outline: "2px solid transparent",
          outlineOffset: 2,
          ...(channel.is_live && { outlineColor: "error.main" }),
          ...(current && { outlineColor: "primary.main", outlineWidth: 3 }),
        }}
      />
      {channel.is_live && showName && (
        <Box
          component={"span"}
          sx={{
            position: "absolute",
            top: size - 10,
            px: 0.5,
            borderRadius: 0.5,
            bgcolor: "error.main",
            color: "common.white",
            fontSize: 9,
            fontWeight: 800,
            letterSpacing: ".05em",
          }}
        >
          LIVE
        </Box>
      )}
      {showName && (
        <Typography
          noWrap
          sx={{
            maxWidth: 62,
            fontSize: 11,
            color: current ? "primary.main" : "text.secondary",
            fontWeight: current ? 700 : 400,
          }}
        >
          {channel.title}
        </Typography>
      )}
    </ButtonBase>
  );
}
