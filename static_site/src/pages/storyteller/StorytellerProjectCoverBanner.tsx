import { Box } from "@mui/material";

export interface StorytellerProjectCoverBannerProps {
  coverUrl?: string;
  // 沒有封面時沿用原本的裝飾造型：只有話、沒有文字故事的專案用方框，其餘用菱形。
  imageOnly?: boolean;
}

// 專案卡片頂部橫幅：有封面就 object-fit: cover 置中裁切，沒有則維持原本裝飾。
export function StorytellerProjectCoverBanner({
  coverUrl,
  imageOnly = false,
}: StorytellerProjectCoverBannerProps) {
  return (
    <Box
      aria-hidden
      sx={{
        position: "relative",
        height: 116,
        flexShrink: 0,
        mx: -2,
        mt: -2,
        overflow: "hidden",
        borderBottom: "1px solid",
        borderColor: "divider",
        bgcolor: coverUrl ? "background.default" : undefined,
        background: coverUrl
          ? undefined
          : "radial-gradient(circle at 65% 40%, color-mix(in srgb, var(--storyteller-accent-main) 18%, transparent), transparent 36%), var(--storyteller-surface-overlay)",
        ...(!coverUrl && {
          "&::before": {
            content: '""',
            position: "absolute",
            inset: 0,
            opacity: 0.45,
            backgroundImage:
              "linear-gradient(var(--storyteller-border-subtle) 1px, transparent 1px), linear-gradient(90deg, var(--storyteller-border-subtle) 1px, transparent 1px)",
            backgroundSize: "26px 26px",
          },
          "&::after": {
            content: '""',
            position: "absolute",
            width: 82,
            height: 82,
            left: "calc(50% - 41px)",
            top: 17,
            border: "1px solid",
            borderColor: imageOnly ? "secondary.main" : "primary.main",
            transform: imageOnly ? "rotate(0deg)" : "rotate(45deg)",
            boxShadow:
              "0 0 28px color-mix(in srgb, var(--storyteller-accent-main) 16%, transparent)",
          },
        }),
      }}
    >
      {coverUrl ? (
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
      ) : null}
    </Box>
  );
}
