import ArticleIcon from "@mui/icons-material/Article";
import DescriptionIcon from "@mui/icons-material/Description";
import ImageIcon from "@mui/icons-material/Image";
import { Box, Chip, Paper, Stack, Tooltip, Typography } from "@mui/material";
import { alpha } from "@mui/material/styles";
import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { formatStorytellerDate } from "@/data/storytellerDate.ts";
import type { WorkspaceViewMode } from "./workspaceViewMode.ts";
import type { StorytellerLore, StorytellerStory } from "@/types/storyteller.ts";

// 工作台作品／設定列表的一列，網站與 SteamLoom Writer 共用（Writer 透過 alias 直接 import，改這支也會影響 Writer）。
// 只列畫面用到的欄位；圖像作品的頁數從 latest_content（StoryImageContent JSON）算。
export type WorkspaceStoryRowData = Pick<
  StorytellerStory,
  | "content_type"
  | "status"
  | "title"
  | "word_count"
  | "updated_at"
  | "latest_content"
>;
export type WorkspaceLoreRowData = Pick<
  StorytellerLore,
  "title" | "word_count" | "updated_at" | "status"
>;

function storyPageCount(
  story: Pick<StorytellerStory, "content_type" | "latest_content">,
) {
  if (story.content_type !== "image") return 0;
  try {
    // 圖像故事的 latest_content 存的是 {"pages": [...]} 這個物件（StoryImageContent），
    // 不是裸陣列——之前這裡直接檢查 Array.isArray(parsed) 一定是 false，導致列表頁
    // 永遠顯示 0 頁，即使實際頁面數量正確存在。
    const parsed = JSON.parse(story.latest_content || "{}");
    const rows = parsed?.pages;
    return Array.isArray(rows) ? rows.length : 0;
  } catch {
    return 0;
  }
}

// 故事與設定共用的公開狀態標籤：公開＝讀者看得到，草稿＝只有作者看得到
function PublicationStatusChip({ isPublic }: { isPublic: boolean }) {
  const { t } = useTranslation();
  return (
    <Chip
      size="small"
      label={t(isPublic ? "writer.rows.public" : "writer.rows.draft")}
      variant="outlined"
      sx={{
        height: 20,
        borderRadius: 1,
        fontWeight: 800,
        color: (theme) =>
          isPublic ? theme.palette.primary.main : theme.palette.text.secondary,
        borderColor: (theme) =>
          isPublic ? theme.palette.primary.main : theme.palette.divider,
        bgcolor: (theme) =>
          isPublic
            ? alpha(theme.palette.primary.main, 0.12)
            : alpha(theme.palette.text.secondary, 0.06),
      }}
    />
  );
}

export function StoryRow({
  story,
  onClick,
  actions,
  collectionChip,
  reorderable,
  dragging,
  onDragStart,
  onDropRow,
  viewMode = "list",
}: {
  story: WorkspaceStoryRowData;
  onClick: () => void;
  actions?: ReactNode;
  // 「全部作品」等混合分組的列表才需要標出這一列實際屬於哪一冊——已經篩選到
  // 單一分組時，每一列都屬於同一冊，標出來只是噪音，由呼叫端決定要不要傳。
  collectionChip?: ReactNode;
  reorderable?: boolean;
  dragging?: boolean;
  onDragStart?: () => void;
  onDropRow?: () => void;
  viewMode?: WorkspaceViewMode;
}) {
  const { t, i18n } = useTranslation();
  const isImage = story.content_type === "image";
  const isPublic = story.status === "completed";
  return (
    <Tooltip title={reorderable ? t("writer.rows.draggable") : ""}>
      <Paper
        onClick={onClick}
        elevation={0}
        draggable={reorderable}
        onDragStart={reorderable ? onDragStart : undefined}
        onDragOver={reorderable ? (event) => event.preventDefault() : undefined}
        onDrop={
          reorderable
            ? (event) => {
                event.preventDefault();
                event.stopPropagation();
                onDropRow?.();
              }
            : undefined
        }
        sx={{
          px: viewMode === "grid" ? 1.5 : { xs: 0.5, sm: 1 },
          py: viewMode === "grid" ? 1.75 : 1.25,
          minHeight: viewMode === "grid" ? 138 : 64,
          borderRadius: 0,
          border: viewMode === "grid" ? 1 : 0,
          borderBottom: 1,
          borderColor: "divider",
          cursor: reorderable ? "grab" : "pointer",
          bgcolor: viewMode === "grid" ? "background.paper" : "transparent",
          opacity: dragging ? 0.55 : 1,
          "&:hover": {
            bgcolor: "action.hover",
            borderColor: "primary.main",
          },
        }}
      >
        <Stack
          direction="row"
          spacing={1.5}
          alignItems="center"
          flexWrap="wrap"
          useFlexGap
        >
          <Box sx={{ color: "primary.main", lineHeight: 0 }}>
            {isImage ? (
              <ImageIcon fontSize="small" />
            ) : (
              <ArticleIcon fontSize="small" />
            )}
          </Box>
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Tooltip title={story.title}>
              <Typography fontWeight={900} noWrap>
                {story.title}
              </Typography>
            </Tooltip>
            <Stack
              direction="row"
              spacing={0.75}
              alignItems="center"
              flexWrap="wrap"
              useFlexGap
            >
              <Typography variant="body2" color="text.secondary" noWrap>
                {isImage
                  ? t("writer.rows.pageCount", { count: storyPageCount(story) })
                  : t("writer.rows.wordCount", { count: story.word_count.toLocaleString(i18n.resolvedLanguage) })}
                <Box
                  component="span"
                  sx={{ display: { xs: "none", sm: "inline" } }}
                >
                  {" "}
                  {t("writer.rows.updated", { date: formatStorytellerDate(story.updated_at, i18n.resolvedLanguage) })}
                </Box>
              </Typography>
              {collectionChip}
              <PublicationStatusChip isPublic={isPublic} />
            </Stack>
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
    </Tooltip>
  );
}

export function LoreRow({
  lore,
  onClick,
  actions,
  collectionChip,
  viewMode = "list",
}: {
  lore: WorkspaceLoreRowData;
  onClick: () => void;
  actions?: ReactNode;
  collectionChip?: ReactNode;
  viewMode?: WorkspaceViewMode;
}) {
  const { t, i18n } = useTranslation();
  return (
    <Paper
      elevation={0}
      onClick={onClick}
      sx={{
        px: viewMode === "grid" ? 1.5 : { xs: 0.5, sm: 1 },
        py: viewMode === "grid" ? 1.75 : 1.25,
        minHeight: viewMode === "grid" ? 138 : 64,
        borderRadius: 0,
        border: viewMode === "grid" ? 1 : 0,
        borderBottom: 1,
        borderColor: "divider",
        cursor: "pointer",
        bgcolor: viewMode === "grid" ? "background.paper" : "transparent",
        "&:hover": {
          bgcolor: "action.hover",
          borderColor: "primary.main",
        },
      }}
    >
      <Stack
        direction="row"
        spacing={1.5}
        alignItems="center"
        flexWrap="wrap"
        useFlexGap
      >
        <Box sx={{ color: "primary.main", lineHeight: 0 }}>
          <DescriptionIcon fontSize="small" />
        </Box>
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Tooltip title={lore.title}>
            <Typography fontWeight={900} noWrap>
              {lore.title}
            </Typography>
          </Tooltip>
          <Stack
            direction="row"
            spacing={0.75}
            alignItems="center"
            flexWrap="wrap"
            useFlexGap
          >
            <Typography variant="body2" color="text.secondary" noWrap>
              {t("writer.rows.wordCount", { count: lore.word_count.toLocaleString(i18n.resolvedLanguage) })}
              <Box
                component="span"
                sx={{ display: { xs: "none", sm: "inline" } }}
              >
                {" "}
                {t("writer.rows.updated", { date: formatStorytellerDate(lore.updated_at, i18n.resolvedLanguage) })}
              </Box>
            </Typography>
            {collectionChip}
            <PublicationStatusChip isPublic={lore.status === "completed"} />
          </Stack>
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
