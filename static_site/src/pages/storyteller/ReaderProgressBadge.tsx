import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import { Box, LinearProgress, Stack, Typography } from "@mui/material";
import type { ReaderProgress } from "./readingRecordStore.ts";
import { useTranslation } from "react-i18next";

// 列表上的閱讀進度：沒讀過不顯示、讀到一半顯示細進度條＋百分比、讀完顯示「讀完」。
// 故事與設定列表共用同一個元件，兩邊呈現才會一致。
export function ReaderProgressBadge({
  progress,
}: {
  progress?: ReaderProgress;
}) {
  const { t } = useTranslation();
  if (!progress || (progress.progress <= 0 && !progress.completed)) {
    return null;
  }
  if (progress.completed) {
    return (
      <Stack
        direction="row"
        spacing={0.5}
        alignItems="center"
        sx={{ color: "success.main", flexShrink: 0 }}
        aria-label={t("web.reader.completedAria")}
      >
        <CheckCircleIcon sx={{ fontSize: 16 }} />
        <Typography variant="caption" fontWeight={700}>
          {t("web.reader.completed")}
        </Typography>
      </Stack>
    );
  }
  return (
    <Stack
      direction="row"
      spacing={0.75}
      alignItems="center"
      sx={{ flexShrink: 0 }}
      aria-label={t("web.reader.progressAria", { progress: progress.progress })}
    >
      <Box sx={{ width: 48 }}>
        <LinearProgress
          variant="determinate"
          value={progress.progress}
          sx={{ height: 4, borderRadius: 2 }}
        />
      </Box>
      <Typography
        variant="caption"
        color="primary"
        sx={{ fontVariantNumeric: "tabular-nums", minWidth: 28 }}
      >
        {progress.progress}%
      </Typography>
    </Stack>
  );
}
