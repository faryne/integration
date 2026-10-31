import { Chip, Stack, Typography } from "@mui/material";
import { Link as RouterLink, useSearchParams } from "react-router-dom";
import { useActressTopicIndex } from "@/apis/av/actress_topic.ts";
import {
  actressTopicPath,
  findActressTopic,
} from "@/helpers/avActressTopic.ts";

/**
 * 女優頁從主題頁點進來時（網址帶 ?topic=slug），在個人檔案多一行這個主題的 chip，點了回主題頁。
 * 只標示「從哪個主題來」，不檢查這位是否符合條件；slug 查不到或 index.json 讀不到就什麼都不顯示
 */
export function ActressTopicChip() {
  const [params] = useSearchParams();
  const slug = params.get("topic") ?? "";
  const index = useActressTopicIndex();
  const hit = slug ? findActressTopic(index.data, slug) : undefined;
  if (!hit) return null;

  return (
    <Stack
      direction="row"
      gap={1}
      sx={{ alignItems: "center", justifyContent: "center" }}
    >
      <Typography color="text.secondary" variant="caption">
        主題
      </Typography>
      <Chip
        clickable
        color="primary"
        component={RouterLink}
        label={hit.topic.label}
        size="small"
        to={actressTopicPath(hit.topic.slug)}
        variant="outlined"
      />
    </Stack>
  );
}
