import ArticleIcon from "@mui/icons-material/Article";
import CollectionsIcon from "@mui/icons-material/Collections";
import { Box, Chip, Paper, Stack, Typography } from "@mui/material";
import type { KeyboardEvent, ReactNode } from "react";
import { SteamRegistrationMarks } from "@/components/storyteller/SteamPanelAccent.tsx";
import {
  formatStorytellerDate,
  storytellerProjectRatingColor,
  storytellerProjectRatingLabel,
} from "@/data/storyteller.ts";
import { steamPanelTopBarSx } from "@/data/storytellerTheme.ts";
import { StorytellerTagChips } from "@/pages/storyteller/StorytellerTagChips.tsx";
import type { StorytellerProject } from "@/types/storyteller.ts";

export interface StorytellerProjectCardProps {
  project: StorytellerProject;
  // 右上角、左下操作列刻意留給呼叫端傳——每個頁面對同一個專案能做的操作不同
  // （工作台能編輯/刪除、追蹤頁能取消追蹤、公開頁只能開始閱讀），這兩塊沒有
  // 「標準答案」；其餘資訊（內容類型、篇數/話數、字數、評分、標籤、作者、更新時間）
  // 一律由這個元件自己從 project 算，呼叫端不用也不該自己重算一次，避免各頁資訊分岔。
  headerAction?: ReactNode;
  actions?: ReactNode;
  // 少數真的因為「頁面情境」而不是「專案本身」才有意義的徽章，例如追蹤頁的
  // 「對外隱藏中」、公開列表頁的「公開閱讀」——這些跟 project 資料無關，
  // 是「你透過什麼情境看到這張卡片」，所以留給呼叫端補在標準 chips 後面。
  extraChips?: ReactNode;
  // 工作台可讓整張卡成為進入專案的主要入口；內部 action 會阻止事件冒泡，避免
  // 點 visibility 或 menu 時同時跳頁。其他公開頁仍可只使用底部按鈕。
  onClick?: () => void;
  // 工作台等 lazy 頁面可在 hover／鍵盤 focus 時提前載入；公開卡片不傳就沒有額外行為。
  onPrefetch?: () => void;
}

export function StorytellerProjectCard({
  project,
  headerAction,
  actions,
  extraChips,
  onClick,
  onPrefetch,
}: StorytellerProjectCardProps) {
  const stories = project.stories ?? [];
  const storiesCount = stories.filter(
    (story) => story.content_type !== "image",
  ).length;
  const imageStoryCount = stories.filter(
    (story) => story.content_type === "image",
  ).length;
  const wordCount = stories.reduce(
    (total, story) => total + story.word_count,
    0,
  );
  return (
    <Paper
      variant="outlined"
      role={onClick ? "link" : undefined}
      tabIndex={onClick ? 0 : undefined}
      onClick={onClick}
      onPointerEnter={onPrefetch}
      onFocus={onPrefetch}
      onKeyDown={(event: KeyboardEvent<HTMLDivElement>) => {
        if (!onClick || (event.key !== "Enter" && event.key !== " ")) return;
        event.preventDefault();
        onClick();
      }}
      sx={{
        p: 2,
        borderRadius: 0,
        height: 1,
        boxSizing: "border-box",
        overflow: "hidden",
        backgroundColor: "background.paper",
        transition:
          "border-color 160ms ease, transform 160ms ease, background-color 160ms ease",
        ...(onClick && {
          cursor: "pointer",
          "&:hover": {
            borderColor: "primary.main",
            bgcolor: "action.hover",
            transform: "translateY(-3px)",
          },
          "&:focus-visible": {
            outline: 2,
            outlineColor: "primary.main",
            outlineOffset: 2,
          },
        }),
        ...steamPanelTopBarSx,
      }}
    >
      <SteamRegistrationMarks inset={7} />
      <Stack spacing={1.5} sx={{ height: 1, minWidth: 0 }}>
        <Box
          aria-hidden
          sx={{
            position: "relative",
            height: 116,
            flexShrink: 0,
            mx: -2,
            mt: -2,
            overflow: "hidden",
            borderBottom: "1px solid",
            borderColor: "divider",
            background:
              "radial-gradient(circle at 65% 40%, color-mix(in srgb, var(--storyteller-accent-main) 18%, transparent), transparent 36%), var(--storyteller-surface-overlay)",
            "&::before": {
              content: '""',
              position: "absolute",
              inset: 0,
              opacity: 0.45,
              backgroundImage:
                "linear-gradient(var(--storyteller-border-subtle) 1px, transparent 1px), linear-gradient(90deg, var(--storyteller-border-subtle) 1px, transparent 1px)",
              backgroundSize: "26px 26px",
            },
            "&::after": {
              content: '""',
              position: "absolute",
              width: 82,
              height: 82,
              left: "calc(50% - 41px)",
              top: 17,
              border: "1px solid",
              borderColor:
                project.content_type === "image"
                  ? "secondary.main"
                  : "primary.main",
              transform:
                project.content_type === "image"
                  ? "rotate(0deg)"
                  : "rotate(45deg)",
              boxShadow:
                "0 0 28px color-mix(in srgb, var(--storyteller-accent-main) 16%, transparent)",
            },
          }}
        />
        <Stack
          direction="row"
          spacing={1}
          alignItems="center"
          justifyContent="space-between"
          sx={{ minWidth: 0 }}
        >
          <Typography
            variant="h6"
            fontWeight={800}
            sx={{ minWidth: 0, overflowWrap: "anywhere" }}
          >
            {project.name}
          </Typography>
          {headerAction && (
            <Box
              onClick={(event) => event.stopPropagation()}
              onKeyDown={(event) => event.stopPropagation()}
              sx={{ flexShrink: 0 }}
            >
              {headerAction}
            </Box>
          )}
        </Stack>
        <Typography
          color="text.secondary"
          sx={{
            minWidth: 0,
            minHeight: "3em",
            overflow: "hidden",
            overflowWrap: "anywhere",
            display: "-webkit-box",
            WebkitBoxOrient: "vertical",
            WebkitLineClamp: 2,
          }}
        >
          {project.description || "尚未填寫專案描述。"}
        </Typography>
        <Stack
          direction="row"
          spacing={1.5}
          flexWrap="wrap"
          useFlexGap
          color="text.secondary"
        >
          <Stack direction="row" spacing={0.5} alignItems="center">
            {project.content_type === "image" ? (
              <CollectionsIcon fontSize="small" />
            ) : (
              <ArticleIcon fontSize="small" />
            )}
            <Typography variant="body2">
              {project.content_type === "image" ? "圖片／漫畫" : "文字故事"}
            </Typography>
          </Stack>
          <Typography variant="body2">{storiesCount} 篇故事</Typography>
          {imageStoryCount > 0 && (
            <Typography variant="body2">{imageStoryCount} 話</Typography>
          )}
          <Typography variant="body2">
            {wordCount.toLocaleString()} 字
          </Typography>
        </Stack>
        <Stack
          direction="row"
          spacing={1}
          alignItems="center"
          flexWrap="wrap"
          useFlexGap
        >
          <Chip
            size="small"
            color={storytellerProjectRatingColor(project.rating)}
            label={storytellerProjectRatingLabel(project.rating)}
          />
          <Typography variant="caption" color="text.secondary">
            {project.rating_count} 人評分 · 平均{" "}
            {project.average_rating.toFixed(1)} · {project.favorite_count}{" "}
            人追蹤
          </Typography>
          {extraChips}
        </Stack>
        <StorytellerTagChips tags={project.tags} limit={3} />
        <Box sx={{ flex: 1 }} />
        <Stack
          direction={{ xs: "column", sm: "row" }}
          spacing={1}
          alignItems={{ xs: "flex-start", sm: "center" }}
          justifyContent="space-between"
        >
          <Typography variant="caption" color="text.secondary">
            {project.author?.pen_name && `作者 ${project.author.pen_name} · `}
            更新於 {formatStorytellerDate(project.updated_at)}
          </Typography>
          {actions && (
            <Stack
              direction="row"
              spacing={1}
              flexWrap="wrap"
              useFlexGap
              onClick={(event) => event.stopPropagation()}
              onKeyDown={(event) => event.stopPropagation()}
            >
              {actions}
            </Stack>
          )}
        </Stack>
      </Stack>
    </Paper>
  );
}
