import ArticleIcon from "@mui/icons-material/Article";
import CollectionsIcon from "@mui/icons-material/Collections";
import SellIcon from "@mui/icons-material/Sell";
import { Box, Chip, Paper, Stack, Typography } from "@mui/material";
import { Link as RouterLink } from "react-router-dom";
import {
  formatStorytellerDate,
  storytellerProjectRatingColor,
  storytellerProjectRatingLabel,
  storytellerSearchResultPath,
} from "@/data/storyteller.ts";
import { steamPanelTopBarSx } from "@/data/storytellerTheme.ts";
import { SteamRivets } from "@/components/storyteller/SteamPanelAccent.tsx";
import type { StorytellerWorkSearchResult } from "@/types/storyteller.ts";

const clampSx = (lines: number) => ({
  display: "-webkit-box",
  WebkitLineClamp: lines,
  WebkitBoxOrient: "vertical" as const,
  overflow: "hidden",
});

export interface StorytellerWorkCardProps {
  result: StorytellerWorkSearchResult;
  // 點標籤直接拿去重新搜尋，呼叫端（Search 頁）決定要怎麼套用。
  onTagClick?: (tag: string) => void;
}

// 一篇搜尋結果（文字故事或圖像作品）的卡片。欄位跟呈現方式比照
// StorytellerProjectCard（分級 chip 用同一組顏色/字樣、標籤 chip 同一個圖示、
// 作者/更新時間合併同一行 caption），只是這裡是「單篇作品」而不是「整個專案」，
// 多了封面縮圖（圖像作品才有）跟內容類型 chip。
export function StorytellerWorkCard({
  result,
  onTagClick,
}: StorytellerWorkCardProps) {
  const isImage = Boolean(result.cover_image_url);

  return (
    <Paper
      variant="outlined"
      component={RouterLink}
      to={storytellerSearchResultPath(result)}
      sx={{
        display: "block",
        borderRadius: 1,
        overflow: "hidden",
        textDecoration: "none",
        color: "inherit",
        height: 1,
        ...steamPanelTopBarSx,
      }}
    >
      <SteamRivets inset={7} />
      {isImage && (
        <Box
          sx={{
            aspectRatio: "16 / 9",
            bgcolor: "action.hover",
            backgroundImage: `url(${result.cover_image_url})`,
            backgroundSize: "cover",
            backgroundPosition: "center",
          }}
        />
      )}
      <Stack spacing={1} sx={{ p: 2 }}>
        <Typography
          variant="caption"
          color="primary.main"
          fontWeight={700}
          sx={{ overflowWrap: "anywhere" }}
        >
          {result.project_name}
        </Typography>
        <Typography
          variant="h6"
          fontWeight={800}
          sx={{ overflowWrap: "anywhere", ...clampSx(2) }}
        >
          {result.title}
        </Typography>
        {result.summary && (
          <Typography
            color="text.secondary"
            variant="body2"
            sx={{ overflowWrap: "anywhere", ...clampSx(2) }}
          >
            {result.summary}
          </Typography>
        )}
        <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
          <Chip
            size="small"
            variant="outlined"
            icon={isImage ? <CollectionsIcon /> : <ArticleIcon />}
            label={isImage ? "圖片／漫畫" : "文字故事"}
          />
          <Chip
            size="small"
            color={storytellerProjectRatingColor(result.rating)}
            label={storytellerProjectRatingLabel(result.rating)}
          />
          {result.tags.map((tag) => (
            <Chip
              key={tag}
              size="small"
              variant="outlined"
              icon={<SellIcon fontSize="small" />}
              label={tag}
              onClick={
                onTagClick
                  ? (event) => {
                      event.preventDefault();
                      event.stopPropagation();
                      onTagClick(tag);
                    }
                  : undefined
              }
            />
          ))}
        </Stack>
        <Typography variant="caption" color="text.secondary">
          {result.author_pen_name && `作者 ${result.author_pen_name} · `}
          更新於 {formatStorytellerDate(result.updated_at)}
        </Typography>
      </Stack>
    </Paper>
  );
}
