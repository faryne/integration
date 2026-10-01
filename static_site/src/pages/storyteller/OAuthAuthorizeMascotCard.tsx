import { Box, Paper } from "@mui/material";
import { alpha } from "@mui/material/styles";
import type { ReactNode } from "react";
import { useContext } from "react";
import {
  storytellerMascotSrc,
  type StorytellerMascotPose,
} from "@/helpers/storytellerMascot.ts";
import { StorytellerAppearanceContext } from "@/layouts/storytellerAppearanceMode.tsx";

// 授權頁的卡片骨架：左邊梭梭（姿勢＋一句台詞），右邊是實際授權內容；版面比照
// StorytellerMascotDialog 的左右配置，窄螢幕改成上方小圖＋對話框。
// 台詞只負責氣氛，權限、跳轉網域等安全資訊一律放在右側正規 UI，不寫進台詞。
export function OAuthAuthorizeMascotCard({
  pose,
  line,
  children,
}: {
  pose: StorytellerMascotPose;
  line: string;
  children: ReactNode;
}) {
  const appearance =
    useContext(StorytellerAppearanceContext)?.appearance ?? "nocturne";
  return (
    <Paper
      variant="outlined"
      sx={{
        width: "min(780px, 100%)",
        display: "grid",
        gridTemplateColumns: {
          xs: "minmax(0, 1fr)",
          sm: "240px minmax(0, 1fr)",
        },
        borderRadius: 2,
        overflow: "hidden",
        boxShadow: "0 18px 60px rgba(0, 0, 0, 0.24)",
      }}
    >
      <Box
        sx={{
          display: "flex",
          flexDirection: { xs: "row", sm: "column" },
          alignItems: { xs: "flex-end", sm: "center" },
          justifyContent: { xs: "flex-start", sm: "flex-end" },
          gap: { xs: 1.25, sm: 0 },
          px: { xs: 2, sm: 1.75 },
          pt: { xs: 2, sm: 2.5 },
          borderRight: { sm: 1 },
          borderBottom: { xs: 1, sm: 0 },
          borderColor: "divider",
          background: (theme) =>
            `linear-gradient(180deg, ${alpha(theme.palette.primary.main, 0.14)}, transparent 70%)`,
        }}
      >
        {/* 對話框放在立繪上方（窄螢幕在右側），不疊在圖上，避免蓋到臉 */}
        <Box
          sx={{
            order: { xs: 1, sm: 0 },
            alignSelf: "stretch",
            position: "relative",
            mb: { xs: 2, sm: 1.5 },
            px: 1.5,
            py: 1.25,
            border: 1,
            borderColor: "divider",
            borderRadius: 2,
            bgcolor: "background.paper",
            typography: "body2",
            lineHeight: 1.6,
            "&::after": {
              content: '""',
              display: { xs: "none", sm: "block" },
              position: "absolute",
              bottom: -6,
              left: "50%",
              width: 10,
              height: 10,
              bgcolor: "background.paper",
              borderRight: 1,
              borderBottom: 1,
              borderColor: "divider",
              transform: "rotate(45deg)",
            },
          }}
        >
          {line}
        </Box>
        <Box
          component="img"
          src={storytellerMascotSrc(pose, appearance)}
          alt="梭梭"
          sx={{
            display: "block",
            width: { xs: 96, sm: "100%" },
            maxWidth: 220,
            flexShrink: 0,
          }}
        />
      </Box>
      <Box sx={{ p: { xs: 2.5, sm: 3.5 }, minWidth: 0 }}>{children}</Box>
    </Paper>
  );
}
