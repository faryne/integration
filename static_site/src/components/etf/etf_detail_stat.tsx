import { Box, Typography } from "@mui/material";

// EtfDetailSummary（配息統計摘要）跟 EtfCandleChart（K線圖統計卡片）共用的
// 小型統計卡片，抽出來避免兩邊互相 import 造成循環依賴。
export const DetailStat = ({
  label,
  value,
  tone,
}: {
  label: string;
  value: React.ReactNode;
  tone?: string;
}) => (
  <Box
    sx={{
      border: "1px solid",
      borderColor: "divider",
      borderRadius: 2,
      p: 1.5,
      bgcolor: "background.paper",
      minWidth: { xs: "calc(50% - 8px)", sm: 132 },
      flex: "1 1 132px",
    }}
  >
    <Typography
      variant="caption"
      sx={{ color: "text.secondary", fontWeight: 800 }}
    >
      {label}
    </Typography>
    <Typography
      variant="h6"
      sx={{ fontWeight: 900, lineHeight: 1.2, color: tone ?? "text.primary" }}
    >
      {value}
    </Typography>
  </Box>
);
