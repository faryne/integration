import { Box, Paper, Stack, Typography } from "@mui/material";
import { useTranslation } from "react-i18next";

export function CustomDiffLegend() {
  const { t } = useTranslation();
  const diffLegendItems = ["added", "removed", "changed", "empty"].map(
    (key, index) => ({
      color: ["success.light", "error.light", "warning.light", "action.hover"][index],
      label: t(`writer:editor.diff.legend.${key}.label`),
      description: t(`writer:editor.diff.legend.${key}.description`),
    }),
  );
  return (
    <Paper variant="outlined" sx={{ borderRadius: 1, p: 2 }}>
      <Stack direction="row" spacing={2} flexWrap="wrap" useFlexGap>
        {/* 統一說明 diff 色塊，避免各比對頁重複維護文案。 */}
        {diffLegendItems.map((item) => (
          <Stack
            key={item.label}
            direction="row"
            spacing={1}
            alignItems="center"
            sx={{ maxWidth: 280 }}
          >
            <Box
              sx={{
                bgcolor: item.color,
                border: "1px solid",
                borderColor: "divider",
                borderRadius: 0.5,
                height: 18,
                width: 28,
                flex: "0 0 auto",
              }}
            />
            <Stack spacing={0}>
              <Typography variant="body2" fontWeight={800}>
                {item.label}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                {item.description}
              </Typography>
            </Stack>
          </Stack>
        ))}
      </Stack>
    </Paper>
  );
}
