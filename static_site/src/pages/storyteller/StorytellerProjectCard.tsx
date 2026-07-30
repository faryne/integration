import ArticleIcon from "@mui/icons-material/Article";
import AutoStoriesIcon from "@mui/icons-material/AutoStories";
import CollectionsIcon from "@mui/icons-material/Collections";
import { Chip, Paper, Stack, Typography } from "@mui/material";
import type { ReactNode } from "react";
import { SteamRivets } from "@/components/storyteller/SteamPanelAccent.tsx";
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
  // （工作台能編輯/刪除、收藏頁能取消收藏、公開頁只能開始閱讀），這兩塊沒有
  // 「標準答案」；其餘資訊（內容類型、篇數/話數、字數、評分、標籤、作者、更新時間）
  // 一律由這個元件自己從 project 算，呼叫端不用也不該自己重算一次，避免各頁資訊分岔。
  headerAction?: ReactNode;
  actions: ReactNode;
  // 少數真的因為「頁面情境」而不是「專案本身」才有意義的徽章，例如收藏頁的
  // 「對外隱藏中」、公開列表頁的「公開閱讀」——這些跟 project 資料無關，
  // 是「你透過什麼情境看到這張卡片」，所以留給呼叫端補在標準 chips 後面。
  extraChips?: ReactNode;
}

export function StorytellerProjectCard({
  project,
  headerAction,
  actions,
  extraChips,
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
      sx={{
        p: 2,
        borderRadius: 1,
        height: 1,
        boxSizing: "border-box",
        overflow: "hidden",
        ...steamPanelTopBarSx,
      }}
    >
      <SteamRivets inset={7} />
      <Stack spacing={1.5} sx={{ height: 1, minWidth: 0 }}>
        <Stack
          direction="row"
          spacing={1}
          alignItems="center"
          justifyContent="space-between"
          sx={{ minWidth: 0 }}
        >
          <Stack
            direction="row"
            spacing={1}
            alignItems="center"
            sx={{ minWidth: 0 }}
          >
            <AutoStoriesIcon color="primary" />
            <Typography
              variant="h6"
              fontWeight={800}
              sx={{ minWidth: 0, overflowWrap: "anywhere" }}
            >
              {project.name}
            </Typography>
          </Stack>
          {headerAction}
        </Stack>
        <Typography
          color="text.secondary"
          sx={{ flex: 1, minWidth: 0, overflowWrap: "anywhere" }}
        >
          {project.description}
        </Typography>
        <Stack
          direction={{ xs: "column", sm: "row" }}
          spacing={1}
          flexWrap={{ sm: "wrap" }}
          useFlexGap
          sx={{
            "& .MuiChip-root": {
              width: { xs: "100%", sm: "auto" },
            },
          }}
        >
          <Chip
            size="small"
            variant="outlined"
            icon={
              project.content_type === "image" ? (
                <CollectionsIcon />
              ) : (
                <ArticleIcon />
              )
            }
            label={project.content_type === "image" ? "圖片／漫畫" : "文字故事"}
          />
          <Chip
            size="small"
            color={storytellerProjectRatingColor(project.rating)}
            label={storytellerProjectRatingLabel(project.rating)}
          />
          <Chip
            size="small"
            variant="outlined"
            icon={<ArticleIcon />}
            label={`${storiesCount} 篇故事`}
          />
          {imageStoryCount > 0 && (
            <Chip
              size="small"
              variant="outlined"
              icon={<CollectionsIcon />}
              label={`${imageStoryCount} 話`}
            />
          )}
          <Chip size="small" label={`${wordCount.toLocaleString()} 字`} />
          <Chip size="small" label={`${project.rating_count} 人評分`} />
          <Chip
            size="small"
            label={`平均 ${project.average_rating.toFixed(1)}`}
          />
          <Chip size="small" label={`${project.favorite_count} 人收藏`} />
          {extraChips}
        </Stack>
        <StorytellerTagChips tags={project.tags} />
        <Typography variant="caption" color="text.secondary">
          {project.author?.pen_name && `作者 ${project.author.pen_name} · `}
          更新於 {formatStorytellerDate(project.updated_at)}
        </Typography>
        <Stack
          direction={{ xs: "column", sm: "row" }}
          spacing={1}
          flexWrap={{ sm: "wrap" }}
          useFlexGap
          sx={{
            "& .MuiButton-root": {
              width: { xs: "100%", sm: "auto" },
            },
          }}
        >
          {actions}
        </Stack>
      </Stack>
    </Paper>
  );
}
