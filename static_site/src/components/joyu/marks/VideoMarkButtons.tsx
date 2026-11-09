import { Box, Button, Rating, Stack, Typography } from "@mui/material";
import BookmarkBorderIcon from "@mui/icons-material/BookmarkBorder";
import BookmarkIcon from "@mui/icons-material/Bookmark";
import CheckCircleOutlineIcon from "@mui/icons-material/CheckCircleOutline";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";

import { useMarkSummary } from "@/apis/av/joyu_marks.ts";
import { CustomSnackbar } from "@/components/common/CustomSnackbar.tsx";

import { useVideoMark } from "./useVideoMark.ts";

/**
 * 影片頁標題下方的片單列：「想看」「看過」兩顆按鈕（互斥）、看過之後的 1～5 星評分，以及全站統計。
 * 星星一直顯示，直接點星星也會變成看過；評分人數少於 3 人時不顯示平均（後端給 null）
 */
export function VideoMarkButtons({ videoNo }: { videoNo: string }) {
  const { ready, mark, toggleStatus, rate, error, clearError } =
    useVideoMark(videoNo);
  const summary = useMarkSummary(videoNo.toLowerCase()).data;
  if (!ready) return null;
  const want = mark?.status === "want";
  const watched = mark?.status === "watched";

  return (
    <Stack
      direction="row"
      flexWrap="wrap"
      gap={1}
      sx={{ alignItems: "center" }}
    >
      <Button
        onClick={() => void toggleStatus("want")}
        size="small"
        startIcon={want ? <BookmarkIcon /> : <BookmarkBorderIcon />}
        variant={want ? "contained" : "outlined"}
      >
        想看
      </Button>
      <Button
        onClick={() => void toggleStatus("watched")}
        size="small"
        startIcon={watched ? <CheckCircleIcon /> : <CheckCircleOutlineIcon />}
        variant={watched ? "contained" : "outlined"}
      >
        看過
      </Button>
      <Rating
        // 用 onChange 拿到點的是第幾顆；再點同一顆 MUI 會給 null，交給 rate 判斷取消
        onChange={(_, v) => void rate(v ?? mark?.rating ?? 0)}
        value={watched ? mark.rating : 0}
      />
      {summary && (
        <Typography color="text.secondary" variant="body2">
          想看 {summary.want.toLocaleString()}・看過{" "}
          {summary.watched.toLocaleString()}
          {summary.rating_avg !== null && (
            <Box
              component="span"
              sx={{ color: "text.primary", fontWeight: 700 }}
            >
              ・★{summary.rating_avg.toFixed(1)}（{summary.rating_count} 人）
            </Box>
          )}
        </Typography>
      )}
      <CustomSnackbar
        message={error}
        onClose={clearError}
        open={!!error}
        severity="error"
      />
    </Stack>
  );
}
