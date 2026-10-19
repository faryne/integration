import { Box, Chip } from "@mui/material";
import { alpha } from "@mui/material/styles";
import { useContext, type SyntheticEvent } from "react";
import { useTranslation } from "react-i18next";
import {
  storytellerDialogMascotSrc,
  storytellerMascotSrc,
  type StorytellerDialogMascotState,
  type StorytellerMascotPose,
} from "@/helpers/storytellerMascot.ts";
import { StorytellerAppearanceContext } from "@/layouts/storytellerAppearanceMode.tsx";
import {
  StorytellerDialog,
  type StorytellerDialogProps,
} from "./StorytellerDialog.tsx";

const stateMeta: Record<
  StorytellerDialogMascotState,
  { key: string; fallback: StorytellerMascotPose }
> = {
  danger: {
    key: "danger",
    fallback: "error",
  },
  success: {
    key: "success",
    fallback: "success",
  },
  thinking: {
    key: "thinking",
    fallback: "thinking",
  },
  neutral: {
    key: "neutral",
    fallback: "idle",
  },
};

export interface StorytellerMascotDialogProps extends Omit<
  StorytellerDialogProps,
  "visual" | "maxWidth"
> {
  state: StorytellerDialogMascotState;
  toneLabel?: string;
}

/** 重大決策與完成狀態使用的看板娘 Dialog；桌面寬度統一由共用骨架控制。 */
export function StorytellerMascotDialog({
  state,
  toneLabel,
  ...props
}: StorytellerMascotDialogProps) {
  const { t } = useTranslation();
  // 編輯器 demo 路由沒有 StorytellerLayout；正式頁面仍由 context 即時跟隨外觀。
  const appearance =
    useContext(StorytellerAppearanceContext)?.appearance ?? "nocturne";
  const meta = stateMeta[state];
  const toneColor =
    state === "danger"
      ? "error.main"
      : state === "success"
        ? "success.main"
        : state === "thinking"
          ? "secondary.main"
          : "primary.main";

  return (
    <StorytellerDialog
      {...props}
      maxWidth="md"
      visual={
        <Box
          sx={{
            position: "relative",
            display: "flex",
            minHeight: { xs: 168, sm: "100%" },
            alignItems: "flex-end",
            justifyContent: "center",
            overflow: "hidden",
            px: 1,
            pt: { xs: 1, sm: 3 },
            background: (theme) => {
              const color =
                state === "danger"
                  ? theme.palette.error.main
                  : state === "success"
                    ? theme.palette.success.main
                    : state === "thinking"
                      ? theme.palette.secondary.main
                      : theme.palette.primary.main;
              return `radial-gradient(circle at 50% 72%, ${alpha(color, 0.2)}, transparent 46%), linear-gradient(145deg, ${alpha(color, 0.1)}, transparent 62%)`;
            },
            "&::after": {
              content: '""',
              position: "absolute",
              bottom: { xs: 4, sm: 16 },
              width: { xs: 130, sm: 180 },
              height: 28,
              borderRadius: "50%",
              bgcolor: "rgba(0, 0, 0, 0.24)",
              filter: "blur(8px)",
            },
          }}
        >
          <Chip
            label={toneLabel ?? t(`writer:mascot.${meta.key}Label`)}
            size="small"
            sx={{
              position: "absolute",
              zIndex: 2,
              top: { xs: 13, sm: 20 },
              left: { xs: 14, sm: 20 },
              color: toneColor,
              bgcolor: (theme) =>
                alpha(
                  state === "danger"
                    ? theme.palette.error.main
                    : state === "success"
                      ? theme.palette.success.main
                      : state === "thinking"
                        ? theme.palette.secondary.main
                        : theme.palette.primary.main,
                  0.12,
                ),
              fontSize: 10,
              fontWeight: 800,
              letterSpacing: "0.08em",
            }}
          />
          <Box
            component="img"
            src={storytellerDialogMascotSrc(state, appearance)}
            alt={t(`writer:mascot.${meta.key}Alt`)}
            onError={(event: SyntheticEvent<HTMLImageElement>) => {
              // S3/CDN 尚未同步新圖時維持可用介面；新圖可讀取後不會走這條 fallback。
              event.currentTarget.onerror = null;
              event.currentTarget.src = storytellerMascotSrc(
                meta.fallback,
                appearance,
              );
            }}
            sx={{
              position: "relative",
              zIndex: 1,
              width: { xs: 150, sm: 205 },
              maxHeight: { xs: 175, sm: 345 },
              objectFit: "contain",
              objectPosition: "bottom",
              filter: "drop-shadow(0 14px 20px rgba(0, 0, 0, 0.34))",
            }}
          />
        </Box>
      }
    />
  );
}
