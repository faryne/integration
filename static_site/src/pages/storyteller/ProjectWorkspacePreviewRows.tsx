import ArticleIcon from "@mui/icons-material/Article";
import DescriptionIcon from "@mui/icons-material/Description";
import ImageIcon from "@mui/icons-material/Image";
import { Box, Button, Chip, Paper, Stack, Typography } from "@mui/material";
import { alpha } from "@mui/material/styles";
import type { ReactNode } from "react";
import { Link as RouterLink } from "react-router-dom";
import { formatStorytellerDate } from "@/data/storyteller.ts";
import { steamloomPath } from "@/helpers/steamloom.ts";
import type { SelectedItem } from "./ProjectWorkspacePreviewTypes.ts";
import { storytellerAssetTitle } from "./storytellerAssetMarkdown.ts";
import type {
  StorytellerAsset,
  StorytellerLore,
  StorytellerStory,
} from "@/types/storyteller.ts";

function storyPageCount(story: StorytellerStory) {
  if (story.content_type !== "image") return 0;
  try {
    const rows = JSON.parse(story.latest_content || "[]");
    return Array.isArray(rows) ? rows.length : 0;
  } catch {
    return 0;
  }
}

export function StoryRow({
  story,
  onClick,
  actions,
}: {
  story: StorytellerStory;
  onClick: () => void;
  actions?: ReactNode;
}) {
  const isImage = story.content_type === "image";
  const isPublic = story.status === "completed";
  return (
    <Paper
      onClick={onClick}
      elevation={0}
      sx={{
        p: 1,
        borderRadius: 1,
        cursor: "pointer",
        bgcolor: "transparent",
        "&:hover": {
          bgcolor: (theme) =>
            theme.palette.mode === "dark" ? "#252525" : "#f1f1ef",
        },
      }}
    >
      <Stack direction="row" spacing={1.5} alignItems="center">
        <Box sx={{ color: "primary.main", lineHeight: 0 }}>
          {isImage ? (
            <ImageIcon fontSize="small" />
          ) : (
            <ArticleIcon fontSize="small" />
          )}
        </Box>
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography fontWeight={900} noWrap>
            {story.title}
          </Typography>
          <Typography variant="body2" color="text.secondary" noWrap>
            {isImage
              ? `${storyPageCount(story)} 頁`
              : `${story.word_count.toLocaleString()} 字`}{" "}
            · 更新於 {formatStorytellerDate(story.updated_at)}
          </Typography>
        </Box>
        <Chip
          size="small"
          label={isPublic ? "公開" : "草稿"}
          variant="outlined"
          sx={{
            height: 22,
            borderRadius: 1,
            fontWeight: 800,
            color: (theme) =>
              isPublic
                ? theme.palette.primary.main
                : theme.palette.text.secondary,
            borderColor: (theme) =>
              isPublic ? theme.palette.primary.main : theme.palette.divider,
            bgcolor: (theme) =>
              isPublic
                ? alpha(theme.palette.primary.main, 0.12)
                : alpha(theme.palette.text.secondary, 0.06),
          }}
        />
        {actions && (
          <Box
            onClick={(event) => event.stopPropagation()}
            sx={{ flexShrink: 0 }}
          >
            {actions}
          </Box>
        )}
      </Stack>
    </Paper>
  );
}

export function LoreRow({
  lore,
  onClick,
  actions,
}: {
  lore: StorytellerLore;
  onClick: () => void;
  actions?: ReactNode;
}) {
  return (
    <Paper
      elevation={0}
      onClick={onClick}
      sx={{
        p: 1,
        borderRadius: 1,
        cursor: "pointer",
        bgcolor: "transparent",
        "&:hover": {
          bgcolor: (theme) =>
            theme.palette.mode === "dark" ? "#252525" : "#f1f1ef",
        },
      }}
    >
      <Stack direction="row" spacing={1.5} alignItems="center">
        <Box sx={{ color: "primary.main", lineHeight: 0 }}>
          <DescriptionIcon fontSize="small" />
        </Box>
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography fontWeight={900} noWrap>
            {lore.title}
          </Typography>
          <Typography variant="body2" color="text.secondary" noWrap>
            {lore.word_count.toLocaleString()} 字 · 更新於{" "}
            {formatStorytellerDate(lore.updated_at)}
          </Typography>
        </Box>
        {actions && (
          <Box
            onClick={(event) => event.stopPropagation()}
            sx={{ flexShrink: 0 }}
          >
            {actions}
          </Box>
        )}
      </Stack>
    </Paper>
  );
}

export function AssetCard({
  asset,
  onClick,
  actions,
}: {
  asset: StorytellerAsset;
  onClick: () => void;
  actions?: ReactNode;
}) {
  return (
    <Paper
      elevation={0}
      onClick={onClick}
      sx={{
        borderRadius: 1,
        overflow: "hidden",
        cursor: "pointer",
        bgcolor: (theme) => alpha(theme.palette.primary.main, 0.035),
        "&:hover": {
          bgcolor: (theme) =>
            theme.palette.mode === "dark" ? "#252525" : "#f1f1ef",
        },
      }}
    >
      <Box
        component="img"
        src={asset.preview_url}
        alt={asset.alt_text || storytellerAssetTitle(asset)}
        sx={{
          width: 1,
          aspectRatio: "16 / 9",
          objectFit: "cover",
          display: "block",
          borderRadius: 1,
        }}
      />
      <Box sx={{ p: 1.25 }}>
        <Stack direction="row" spacing={1} alignItems="center">
          <Box sx={{ minWidth: 0, flex: 1 }}>
            <Typography fontWeight={900} noWrap>
              {storytellerAssetTitle(asset)}
            </Typography>
            <Typography variant="body2" color="text.secondary" noWrap>
              引用 {asset.reference_count} 次 · {asset.mime_type}
            </Typography>
          </Box>
          {actions && (
            <Box
              onClick={(event) => event.stopPropagation()}
              sx={{ flexShrink: 0 }}
            >
              {actions}
            </Box>
          )}
        </Stack>
      </Box>
    </Paper>
  );
}

export function EditorPlaceholder({
  item,
  projectId,
  onBack,
}: {
  item: SelectedItem;
  projectId: string;
  onBack: () => void;
}) {
  const title =
    item.type === "story"
      ? item.row.title
      : item.type === "lore"
        ? item.row.title
        : storytellerAssetTitle(item.row);
  const editPath =
    item.type === "story"
      ? steamloomPath(
          `my/project/${projectId}/${item.row.content_type === "image" ? "image" : "story"}/${item.row.public_id}`,
        )
      : item.type === "lore"
        ? steamloomPath(`my/project/${projectId}/lore/${item.row.public_id}`)
        : "";
  return (
    <Paper
      elevation={0}
      sx={{ p: { xs: 0, md: 1 }, borderRadius: 1, bgcolor: "transparent" }}
    >
      <Stack spacing={2}>
        <Stack direction="row" justifyContent="space-between" spacing={1}>
          <Button onClick={onBack}>回列表</Button>
          {editPath && (
            <Button component={RouterLink} to={editPath} variant="contained">
              開啟既有編輯頁
            </Button>
          )}
        </Stack>
        <Box>
          <Typography variant="h5" fontWeight={900}>
            {title}
          </Typography>
          <Typography color="text.secondary">
            這裡是第二階段要承載正式編輯器的位置；第一階段先用此區塊確認右欄寬度、工具列配置與左欄保留時的閱讀感。
          </Typography>
        </Box>
        {item.type === "asset" && (
          <Box
            component="img"
            src={item.row.preview_url}
            alt={item.row.alt_text || storytellerAssetTitle(item.row)}
            sx={{
              width: 1,
              maxHeight: 360,
              objectFit: "contain",
              borderRadius: 1,
            }}
          />
        )}
      </Stack>
    </Paper>
  );
}
