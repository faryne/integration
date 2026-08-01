import SellIcon from "@mui/icons-material/Sell";
import { Chip, Link as MuiLink, Paper, Stack, Typography } from "@mui/material";
import { Link as RouterLink } from "react-router-dom";
import {
  storytellerProjectRatingColor,
  storytellerProjectRatingLabel,
  storytellerReaderPath,
  storytellerSearchResultPath,
} from "@/data/storyteller.ts";
import { steamPanelTopBarSx } from "@/data/storytellerTheme.ts";
import { SteamRivets } from "@/components/storyteller/SteamPanelAccent.tsx";
import type { StorytellerProjectSearchResult } from "@/types/storyteller.ts";

export interface StorytellerProjectSearchCardProps {
  result: StorytellerProjectSearchResult;
  onTagClick?: (tag: string) => void;
}

// 「依專案分組」搜尋結果的卡片：專案名稱／分級／作者比照 StorytellerProjectCard 的
// 呈現方式，多出來的是「這個專案裡命中的幾篇故事」清單——命中的故事可以直接點進去，
// 不用先進專案頁再自己找。matched_story_count 可能比顯示出來的 matches 還多。
export function StorytellerProjectSearchCard({
  result,
  onTagClick,
}: StorytellerProjectSearchCardProps) {
  const remaining = result.matched_story_count - result.matches.length;

  return (
    <Paper
      variant="outlined"
      sx={{ p: 2, borderRadius: 1, height: 1, boxSizing: "border-box", ...steamPanelTopBarSx }}
    >
      <SteamRivets inset={7} />
      <Stack spacing={1.5} sx={{ height: 1 }}>
        <Stack
          direction="row"
          spacing={1}
          justifyContent="space-between"
          alignItems="flex-start"
        >
          <Typography
            component={RouterLink}
            to={storytellerReaderPath({
              public_id: result.project_public_id,
              slug: result.project_slug,
            })}
            variant="h6"
            fontWeight={800}
            sx={{
              color: "inherit",
              textDecoration: "none",
              overflowWrap: "anywhere",
              minWidth: 0,
            }}
          >
            {result.project_name}
          </Typography>
          <Chip
            size="small"
            color={storytellerProjectRatingColor(result.rating)}
            label={storytellerProjectRatingLabel(result.rating)}
          />
        </Stack>
        <Typography variant="body2" color="text.secondary">
          {result.matched_story_count} 篇故事符合
          {result.author_pen_name && ` · 作者 ${result.author_pen_name}`}
        </Typography>
        <Stack spacing={0.5} sx={{ flex: 1 }}>
          {result.matches.map((match) => (
            <MuiLink
              key={match.story_public_id}
              component={RouterLink}
              to={storytellerSearchResultPath(match)}
              underline="hover"
              variant="body2"
              sx={{ overflowWrap: "anywhere" }}
            >
              {match.title}
            </MuiLink>
          ))}
          {remaining > 0 && (
            <Typography variant="caption" color="text.secondary">
              還有 {remaining} 篇故事符合……
            </Typography>
          )}
        </Stack>
        {result.tags.length > 0 && (
          <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
            {result.tags.map((tag) => (
              <Chip
                key={tag}
                size="small"
                variant="outlined"
                icon={<SellIcon fontSize="small" />}
                label={tag}
                onClick={
                  onTagClick
                    ? () => onTagClick(tag)
                    : undefined
                }
              />
            ))}
          </Stack>
        )}
      </Stack>
    </Paper>
  );
}
