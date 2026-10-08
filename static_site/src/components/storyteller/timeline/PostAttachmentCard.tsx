import CloseIcon from "@mui/icons-material/Close";
import { Box, Chip, IconButton, Stack, Typography } from "@mui/material";
import type { MouseEvent } from "react";
import { Link as RouterLink } from "react-router-dom";
import {
  storytellerReaderPath,
  storytellerSearchResultPath,
} from "@/data/storyteller.ts";
import { useGatedCoverUrl } from "@/helpers/storytellerCover.ts";
import type { AuthorPostAttachment } from "@/types/storytellerTimeline.ts";

// 動態上的作品卡：整部作品或某一話。限制級封面沿用年齡確認閘門；作品已不可見時只顯示提示。
export function PostAttachmentCard({
  attachment,
  onRemove,
}: {
  attachment: AuthorPostAttachment;
  // 發文框預覽用：顯示移除按鈕、不給連結
  onRemove?: () => void;
}) {
  const coverUrl = useGatedCoverUrl(attachment.cover_url, attachment.rating);
  const restricted = attachment.rating === "restricted";
  const frame = {
    display: "flex",
    gap: 1.5,
    alignItems: "center",
    p: 1.25,
    mt: 1,
    maxWidth: 460,
    border: 1,
    borderColor: "divider",
    borderRadius: 1.25,
    bgcolor: "action.hover",
    color: "inherit",
    textDecoration: "none",
  } as const;

  if (attachment.unavailable) {
    return (
      <Box sx={frame}>
        <Typography variant="body2" color="text.secondary">
          這部作品目前無法瀏覽
        </Typography>
      </Box>
    );
  }

  const to =
    attachment.story_public_id && attachment.project_public_id
      ? storytellerSearchResultPath({
          project_public_id: attachment.project_public_id,
          project_slug: attachment.project_slug ?? "",
          story_public_id: attachment.story_public_id,
        })
      : storytellerReaderPath({
          public_id: attachment.project_public_id ?? "",
          slug: attachment.project_slug ?? "",
        });
  const subtitle = attachment.story_title
    ? [attachment.volume_title, attachment.story_title]
        .filter(Boolean)
        .join("・")
    : "作品首頁";

  return (
    <Box
      {...(onRemove
        ? {}
        : {
            component: RouterLink,
            to,
            onClick: (event: MouseEvent) => event.stopPropagation(),
          })}
      sx={{
        ...frame,
        "&:hover": onRemove ? undefined : { borderColor: "primary.main" },
      }}
    >
      <Box
        sx={(theme) => ({
          flex: "none",
          width: 48,
          height: 64,
          borderRadius: 0.75,
          display: "grid",
          placeItems: "center",
          overflow: "hidden",
          color: restricted ? "error.main" : "common.white",
          fontSize: 11,
          fontWeight: 800,
          background: coverUrl
            ? `center / cover no-repeat url("${coverUrl}")`
            : restricted
              ? `repeating-linear-gradient(45deg, ${theme.palette.action.selected}, ${theme.palette.action.selected} 6px, transparent 6px, transparent 12px)`
              : `linear-gradient(160deg, ${theme.palette.primary.dark}, ${theme.palette.grey[900]})`,
        })}
      >
        {!coverUrl &&
          (restricted ? "R18" : attachment.project_name?.slice(0, 2))}
      </Box>
      <Stack spacing={0.25} sx={{ minWidth: 0, flex: 1 }}>
        <Typography fontWeight={800} noWrap>
          《{attachment.project_name}》
        </Typography>
        <Stack direction="row" spacing={0.75} alignItems="center">
          <Typography variant="caption" color="text.secondary" noWrap>
            {subtitle}
          </Typography>
          {restricted && (
            <Chip
              size="small"
              color="error"
              variant="outlined"
              label="限制級"
            />
          )}
        </Stack>
      </Stack>
      {onRemove && (
        <IconButton
          size="small"
          aria-label="移除作品卡"
          onClick={onRemove}
          sx={{ alignSelf: "flex-start" }}
        >
          <CloseIcon fontSize="small" />
        </IconButton>
      )}
    </Box>
  );
}
