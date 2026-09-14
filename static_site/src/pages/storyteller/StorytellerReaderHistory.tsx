import { Box, Stack, Typography } from "@mui/material";
import { Link as RouterLink } from "react-router-dom";
import { formatStorytellerDate } from "@/data/storyteller.ts";
import type { StorytellerStoryVersion } from "@/types/storyteller.ts";

export function StorytellerReaderHistory({
  versions,
  loading,
  basePath,
  storyId,
  onSelect,
}: {
  versions: StorytellerStoryVersion[];
  loading: boolean;
  basePath: string;
  storyId: string;
  onSelect: () => void;
}) {
  if (loading) {
    return (
      <Typography variant="body2" color="text.secondary" sx={{ py: 2 }}>
        載入版本中...
      </Typography>
    );
  }
  if (versions.length === 0) {
    return (
      <Typography variant="body2" color="text.secondary" sx={{ py: 2 }}>
        尚無編輯歷史。
      </Typography>
    );
  }

  return (
    <Stack divider={<Box sx={{ borderTop: 1, borderColor: "divider" }} />}>
      {versions.map((version, index) => {
        const label =
          index === 0
            ? `第 ${versions.length} 版（最新）`
            : `第 ${versions.length - index} 版`;
        return (
          <Box
            key={version.id}
            component={RouterLink}
            to={`${basePath}/story/${storyId}/versions/${version.id}`}
            onClick={onSelect}
            sx={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              gap: 2,
              py: 1,
              textDecoration: "none",
              color: "inherit",
              "&:hover": { color: "primary.main" },
            }}
          >
            <Typography variant="body2">{label}</Typography>
            <Typography variant="caption" color="text.secondary" noWrap>
              {formatStorytellerDate(version.created_at)}
            </Typography>
          </Box>
        );
      })}
    </Stack>
  );
}
