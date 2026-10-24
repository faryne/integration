import {
  Box,
  Button,
  Dialog,
  Skeleton,
  Stack,
  Typography,
  useMediaQuery,
  useTheme,
} from "@mui/material";
import OpenInNewIcon from "@mui/icons-material/OpenInNew";
import type { ReactNode } from "react";
import { useLayoutEffect, useRef, useState } from "react";

import { LinkifiedText } from "@/components/common/LinkifiedText.tsx";

interface YouTubeDialogProps {
  open: boolean;
  videoId: string;
  title: string;
  // Shorts 等直式影片：播放器 9:16；桌機改成左邊播放器、右邊資訊欄
  vertical?: boolean;
  // 標題下方那一行（頻道、時間、狀態等），由各功能自己組
  meta?: ReactNode;
  // 說明：undefined 且 descriptionLoading 時顯示載入中；空字串不顯示
  description?: string;
  descriptionLoading?: boolean;
  onClose: () => void;
}

/**
 * 嵌入 YouTube 播放的 dialog，橫式／直式共用。
 * 橫式：播放器、標題、meta、說明、按鈕由上往下；手機上按鈕平分寬度。
 * 直式：桌機左右並排（跟 YouTube 網頁版看 Shorts 一樣），資訊欄太長只捲右邊；手機寬度不夠，改回上下排、整個 dialog 捲動。
 */
export function YouTubeDialog(props: YouTubeDialogProps) {
  const theme = useTheme();
  const narrow = useMediaQuery(theme.breakpoints.down("sm"));
  const sideBySide = Boolean(props.vertical) && !narrow;

  return (
    <Dialog
      open={props.open}
      onClose={props.onClose}
      maxWidth={sideBySide ? false : props.vertical ? "xs" : "md"}
      fullWidth={!sideBySide}
      slotProps={{
        paper: {
          sx: sideBySide
            ? {
                flexDirection: "row",
                height: "min(760px, calc(100vh - 64px))",
                overflow: "hidden",
              }
            : props.vertical
              ? { overflowY: "auto" }
              : undefined,
        },
      }}
    >
      {/* 換影片時用 key 重建，展開狀態與截斷判斷跟著重來；關閉時內容保留到淡出結束 */}
      <DialogBody key={props.videoId} {...props} sideBySide={sideBySide} />
    </Dialog>
  );
}

function DialogBody({
  videoId,
  title,
  vertical,
  meta,
  description,
  descriptionLoading,
  onClose,
  sideBySide,
}: YouTubeDialogProps & { sideBySide: boolean }) {
  // 直式手機版：寬度不夠並排，整個 dialog 一起捲；其他情況只捲資訊區、按鈕固定在最下面
  const scrollWhole = Boolean(vertical) && !sideBySide;
  return (
    <>
      <Box
        sx={{
          flexShrink: 0,
          bgcolor: "common.black",
          aspectRatio: vertical ? "9 / 16" : "16 / 9",
          ...(sideBySide && { height: "100%" }),
        }}
      >
        <Box
          component={"iframe"}
          src={`https://www.youtube.com/embed/${videoId}?autoplay=1`}
          title={title}
          allow={
            "accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          }
          allowFullScreen
          sx={{ width: "100%", height: "100%", border: 0, display: "block" }}
        />
      </Box>
      <Box
        sx={{
          display: "flex",
          flexDirection: "column",
          // 直式手機版是整個 dialog 一起捲，這裡不能被壓縮，不然說明會溢出蓋到按鈕
          ...(scrollWhole
            ? { flexShrink: 0 }
            : { minHeight: 0, flex: "1 1 auto" }),
          ...(sideBySide && { width: 360 }),
        }}
      >
        {/* 資訊區太長時只捲這一塊，按鈕固定在最下面（直式手機版改成整個 dialog 捲） */}
        <Box
          sx={{
            px: 2,
            pt: 2,
            pb: 0.5,
            ...(scrollWhole
              ? {}
              : { minHeight: 0, overflowY: "auto", flex: "1 1 auto" }),
          }}
        >
          <ClampedText
            lines={sideBySide ? 0 : { xs: 3, sm: 2 }}
            fontWeight={700}
            fontSize={15}
          >
            {title}
          </ClampedText>
          {meta && <Box sx={{ mt: 1 }}>{meta}</Box>}
          <Description
            text={description}
            loading={descriptionLoading}
            expanded={sideBySide}
          />
        </Box>
        <Stack
          direction={"row"}
          spacing={1}
          sx={{
            px: 2,
            pt: 1,
            pb: 2,
            flexShrink: 0,
            justifyContent: { sm: sideBySide ? "stretch" : "flex-end" },
          }}
        >
          <Button
            variant={"outlined"}
            startIcon={<OpenInNewIcon />}
            href={`https://www.youtube.com/watch?v=${videoId}`}
            target={"_blank"}
            rel={"noopener"}
            sx={{ ...buttonSx, flex: { xs: 1, sm: sideBySide ? 1 : "none" } }}
          >
            在 YouTube 開啟
          </Button>
          <Button
            onClick={onClose}
            color={"inherit"}
            sx={{ ...buttonSx, flex: { xs: 1, sm: sideBySide ? 1 : "none" } }}
          >
            關閉
          </Button>
        </Stack>
      </Box>
    </>
  );
}

// 不轉大寫、不換行（「YOUTUBE」大寫會變寬，窄螢幕被擠成三行）
const buttonSx = { textTransform: "none", whiteSpace: "nowrap" } as const;

function Description({
  text,
  loading,
  expanded,
}: {
  text?: string;
  loading?: boolean;
  expanded: boolean;
}) {
  if (loading && text === undefined) {
    return (
      <Box sx={{ mt: 1.5 }}>
        <Skeleton width={"90%"} />
        <Skeleton width={"70%"} />
      </Box>
    );
  }
  if (!text?.trim()) return null;
  return (
    <Box
      sx={{
        mt: 1.5,
        px: 1.5,
        py: 1.25,
        borderRadius: 1,
        bgcolor: "action.hover",
      }}
    >
      <ClampedText lines={expanded ? 0 : 3} fontSize={13} preLine>
        <LinkifiedText text={text} />
      </ClampedText>
    </Box>
  );
}

type Lines = number | { xs: number; sm: number };

/** 超過行數上限就截斷，真的被截斷時才出現「展開」；lines 為 0 代表不截斷 */
function ClampedText({
  lines,
  fontWeight,
  fontSize,
  preLine,
  children,
}: {
  lines: Lines;
  fontWeight?: number;
  fontSize: number;
  preLine?: boolean;
  children: ReactNode;
}) {
  const ref = useRef<HTMLElement>(null);
  const [expanded, setExpanded] = useState(false);
  const [truncated, setTruncated] = useState(false);
  const clamp = lines !== 0 && !expanded;

  useLayoutEffect(() => {
    const el = ref.current;
    if (el && clamp) setTruncated(el.scrollHeight > el.clientHeight + 1);
  }, [clamp, children]);

  return (
    <>
      <Typography
        ref={ref}
        fontWeight={fontWeight}
        fontSize={fontSize}
        sx={{
          lineHeight: preLine ? 1.7 : 1.5,
          wordBreak: "break-word",
          ...(preLine && { whiteSpace: "pre-line" }),
          ...(clamp && {
            display: "-webkit-box",
            WebkitLineClamp: lines,
            WebkitBoxOrient: "vertical",
            overflow: "hidden",
          }),
        }}
      >
        {children}
      </Typography>
      {lines !== 0 && (truncated || expanded) && (
        <Button
          size={"small"}
          onClick={() => setExpanded(!expanded)}
          sx={{ px: 0, minWidth: 0 }}
        >
          {expanded ? "收合" : preLine ? "顯示完整說明" : "展開"}
        </Button>
      )}
    </>
  );
}
