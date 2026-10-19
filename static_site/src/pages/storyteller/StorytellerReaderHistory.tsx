import { Box, Stack, Typography } from "@mui/material";
import { Link as RouterLink } from "react-router-dom";
import { formatStorytellerDate } from "@/data/storyteller.ts";
import { readerStoryVersionPath } from "@/helpers/storytellerReaderPaths.ts";
import type { StorytellerStoryVersion } from "@/types/storyteller.ts";
import { useTranslation } from "react-i18next";

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
  const { t, i18n } = useTranslation();
  if (loading) {
    return (
      <Typography variant="body2" color="text.secondary" sx={{ py: 2 }}>
        {t("web.reader.historyLoading")}
      </Typography>
    );
  }
  if (versions.length === 0) {
    return (
      <Typography variant="body2" color="text.secondary" sx={{ py: 2 }}>
        {t("web.reader.historyEmpty")}
      </Typography>
    );
  }

  return (
    <Stack divider={<Box sx={{ borderTop: 1, borderColor: "divider" }} />}>
      {versions.map((version, index) => {
        const label =
          index === 0
            ? t("web.reader.latestVersion", { version: versions.length })
            : t("web.reader.version", { version: versions.length - index });
        return (
          <Box
            key={version.id}
            component={RouterLink}
            to={readerStoryVersionPath(basePath, storyId, version.id)}
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
              {formatStorytellerDate(version.created_at, i18n.resolvedLanguage)}
            </Typography>
          </Box>
        );
      })}
    </Stack>
  );
}
