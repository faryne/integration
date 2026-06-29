import { Box, Paper, Stack, Typography } from "@mui/material";

const diffLegendItems = [
  {
    color: "success.light",
    label: "新增",
    description: "綠色代表新版本新增的內容。",
  },
  {
    color: "error.light",
    label: "移除",
    description: "紅色代表舊版本中被移除的內容。",
  },
  {
    color: "warning.light",
    label: "修改",
    description: "黃色代表同一行內容有所變更。",
  },
  {
    color: "action.hover",
    label: "空白對照",
    description: "灰色代表另一側沒有對應內容。",
  },
];

export function CustomDiffLegend() {
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
