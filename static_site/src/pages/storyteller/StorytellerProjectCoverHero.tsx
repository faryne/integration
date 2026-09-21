import { Box } from "@mui/material";

// 閱讀頁「作品首頁」的封面橫幅：與閱讀內容同寬，16:9 封面依寬度置中裁成較扁的橫幅
// （封面主體要落在中央安全區內，見 DevelopDocuments/storyteller/專案封面圖_2026-09-21.md）。
// 標題就在旁邊，圖片本身是裝飾，alt 留空。
export function StorytellerProjectCoverHero({
  coverUrl,
}: {
  coverUrl: string;
}) {
  return (
    <Box
      sx={{
        width: 1,
        maxWidth: 1200,
        alignSelf: "center",
        mb: { xs: 2, md: 3 },
        boxSizing: "border-box",
        overflow: "hidden",
        border: "1px solid",
        borderColor: "divider",
        bgcolor: "action.hover",
        aspectRatio: { xs: "16 / 9", md: "21 / 9" },
        maxHeight: 420,
      }}
    >
      <Box
        component="img"
        src={coverUrl}
        alt=""
        sx={{
          width: 1,
          height: 1,
          objectFit: "cover",
          objectPosition: "center",
          display: "block",
        }}
      />
    </Box>
  );
}
