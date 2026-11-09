import { Box } from "@mui/material";

import { useMyMarks } from "./useVideoMark.ts";

/** 影片卡片封面左上角的片單小標（想看／看過★N）；父層要是 position: relative。沒登入或不在片單裡就不顯示 */
export function VideoMarkBadge({ videoNo }: { videoNo: string }) {
  const mark = useMyMarks().get(videoNo.toLowerCase());
  if (!mark) return null;
  const watched = mark.status === "watched";
  return (
    <Box
      component="span"
      sx={{
        bgcolor: watched ? "success.main" : "secondary.main",
        borderRadius: 0.75,
        color: "#fff",
        fontSize: 11,
        fontWeight: 700,
        left: 6,
        lineHeight: 1.6,
        pointerEvents: "none",
        position: "absolute",
        px: 0.75,
        top: 6,
      }}
    >
      {watched ? `看過${mark.rating ? ` ★${mark.rating}` : ""}` : "想看"}
    </Box>
  );
}
