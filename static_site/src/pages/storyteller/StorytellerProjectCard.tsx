import AutoStoriesIcon from "@mui/icons-material/AutoStories";
import { Paper, Stack, Typography } from "@mui/material";
import type { ReactNode } from "react";
import { formatStorytellerDate } from "@/data/storyteller.ts";

export interface StorytellerProjectCardProps {
  name: string;
  description: string;
  updatedAt: string;
  chips: ReactNode;
  actions: ReactNode;
  authorName?: string;
  headerAction?: ReactNode;
}

export function StorytellerProjectCard(props: StorytellerProjectCardProps) {
  return (
    <Paper
      variant="outlined"
      sx={{
        p: 2,
        borderRadius: 1,
        height: 1,
        boxSizing: "border-box",
        overflow: "hidden",
      }}
    >
      <Stack spacing={1.5} sx={{ height: 1, minWidth: 0 }}>
        <Stack
          direction="row"
          spacing={1}
          alignItems="center"
          justifyContent="space-between"
          sx={{ minWidth: 0 }}
        >
          <Stack direction="row" spacing={1} alignItems="center" sx={{ minWidth: 0 }}>
            <AutoStoriesIcon color="primary" />
            <Typography
              variant="h6"
              fontWeight={800}
              sx={{ minWidth: 0, overflowWrap: "anywhere" }}
            >
              {props.name}
            </Typography>
          </Stack>
          {props.headerAction}
        </Stack>
        <Typography
          color="text.secondary"
          sx={{ flex: 1, minWidth: 0, overflowWrap: "anywhere" }}
        >
          {props.description}
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
          {props.chips}
        </Stack>
        <Typography variant="caption" color="text.secondary">
          {props.authorName && `作者 ${props.authorName} · `}
          更新於 {formatStorytellerDate(props.updatedAt)}
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
          {props.actions}
        </Stack>
      </Stack>
    </Paper>
  );
}
