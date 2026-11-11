import { useState } from "react";
import { Rating, Stack, Typography } from "@mui/material";

import { CustomSnackbar } from "@/components/common/CustomSnackbar.tsx";

/**
 * 共用評分：提示字＋星星，評完自己收起並跳感謝提示。
 * 分數怎麼記（GA、後端…）與「要不要再問」由使用處決定：評過就別渲染這個元件。
 * precision：最小刻度（預設 1；給 0.5 可以評半顆星，onScore 會收到 3.5 這種值）
 */
export function ScoreRating({
  titleText,
  onScore,
  precision = 1,
  thanksText = "謝謝評分",
}: {
  titleText: string;
  onScore: (score: number) => void;
  precision?: number;
  thanksText?: string;
}) {
  const [done, setDone] = useState(false);
  const [thanks, setThanks] = useState(false);
  return (
    <>
      {!done && (
        <Stack direction="row" spacing={0.5} sx={{ alignItems: "center" }}>
          <Typography color="text.secondary" sx={{ fontSize: 12 }}>
            {titleText}
          </Typography>
          <Rating
            onChange={(_, v) => {
              if (v === null) return;
              onScore(v);
              setDone(true);
              setThanks(true);
            }}
            precision={precision}
            size="small"
          />
        </Stack>
      )}
      <CustomSnackbar
        message={thanksText}
        onClose={() => setThanks(false)}
        open={thanks}
      />
    </>
  );
}
