import React from "react";
import {
  Card,
  CardContent,
  CardActionArea,
  Typography,
  Box,
  Chip,
  Avatar,
  Divider,
  Stack,
} from "@mui/material";
import BusinessIcon from "@mui/icons-material/Business";
import EventNoteIcon from "@mui/icons-material/EventNote";
import TrendingUpIcon from "@mui/icons-material/TrendingUp";
import type { TwseEtfInfo } from "@/types/etf.ts";

export const OptimizedEtfCard: React.FC<{
  etf: TwseEtfInfo;
  onClick: (code: string) => void;
}> = ({ etf, onClick }) => {
  return (
    <Card
      sx={{
        height: "100%", // 關鍵 1：讓卡片填滿 Grid 高度
        display: "flex",
        flexDirection: "column",
        borderRadius: 3,
        position: "relative",
        transition: "0.3s",
        "&:hover": { boxShadow: 10, transform: "translateY(-5px)" },
        "&::before": {
          content: '""',
          position: "absolute",
          left: 0,
          top: 0,
          bottom: 0,
          width: "6px",
          backgroundColor: "primary.main",
        },
      }}
    >
      <CardActionArea onClick={() => onClick(etf.code)} sx={{ p: 1 }}>
        <CardContent>
          {/* 上半部：標題與頭像 */}
          <Box sx={{ display: "flex", alignItems: "flex-start", mb: 2 }}>
            <Avatar
              sx={{
                bgcolor: "primary.light",
                width: 48,
                height: 48,
                mr: 2,
                fontSize: "1.2rem",
                fontWeight: "bold",
              }}
            >
              {etf.company.substring(0, 1)}
            </Avatar>
            <Box sx={{ flexGrow: 1 }}>
              <Box
                sx={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                }}
              >
                <Chip
                  label={etf.code}
                  size="small"
                  color="primary"
                  sx={{ fontWeight: "bold", borderRadius: "6px" }}
                />
                <Stack direction="row" alignItems="center" spacing={0.5}>
                  <EventNoteIcon
                    sx={{ fontSize: 14, color: "text.secondary" }}
                  />
                  <Typography variant="caption" color="text.secondary">
                    {etf.date}
                  </Typography>
                </Stack>
              </Box>
              <Typography
                variant="h6"
                sx={{ fontWeight: 800, mt: 0.5, color: "#2c3e50" }}
              >
                {etf.name}
              </Typography>
            </Box>
          </Box>

          <Divider sx={{ my: 1.5, borderStyle: "dashed" }} />

          {/* 下半部：詳細資訊 */}
          <Stack spacing={1.5}>
            <Box sx={{ display: "flex", alignItems: "center" }}>
              <BusinessIcon
                sx={{ fontSize: 18, mr: 1, color: "action.active" }}
              />
              <Typography
                variant="body2"
                color="text.secondary"
                sx={{ fontWeight: 500 }}
              >
                {etf.company}
              </Typography>
            </Box>

            <Box
              sx={{
                bgcolor: "action.hover",
                p: 1.5,
                borderRadius: 2,
                border: "1px solid",
                borderColor: "divider",
              }}
            >
              <Stack direction="row" spacing={1} alignItems="flex-start">
                <TrendingUpIcon
                  sx={{ fontSize: 18, mt: 0.3, color: "primary.main" }}
                />
                <Box>
                  <Typography
                    variant="caption"
                    sx={{
                      fontWeight: "bold",
                      color: "text.secondary",
                      display: "block",
                    }}
                  >
                    追蹤目標指數
                  </Typography>
                  <Typography
                    variant="body2"
                    sx={{ lineHeight: 1.4, color: "text.primary" }}
                  >
                    {etf.target}
                  </Typography>
                </Box>
              </Stack>
            </Box>
          </Stack>
        </CardContent>
      </CardActionArea>
    </Card>
  );
};

// 在 Grid 迴圈中使用：
// {processedEtfs.map((etf) => (
//   <Grid item xs={12} sm={6} md={4} key={etf.code}>
//     <OptimizedEtfCard etf={etf} onClick={() => handleOpen(etf)} />
//   </Grid>
// ))}
