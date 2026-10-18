import AutoStoriesIcon from "@mui/icons-material/AutoStories";
import DescriptionOutlinedIcon from "@mui/icons-material/DescriptionOutlined";
import { Chip, type ChipProps } from "@mui/material";
import type { CommentRef } from "@/pages/storyteller/wysiwygCore/commentRefs.ts";
import type { CommentRefTarget } from "./useCommentRefTargets.ts";

// 註解參照的小 chip：故事／設定各一個 icon；清單載完還找不到就是已刪除（或被移到別的專案）
export function CommentRefChip({
  refItem,
  target,
  loaded,
  ...chipProps
}: { refItem: CommentRef; target?: CommentRefTarget; loaded: boolean } & Omit<
  ChipProps,
  "label" | "icon"
>) {
  const missing = loaded && !target;
  return (
    <Chip
      size="small"
      variant="outlined"
      icon={
        refItem.kind === "lore" ? (
          <AutoStoriesIcon />
        ) : (
          <DescriptionOutlinedIcon />
        )
      }
      label={target?.title || (missing ? "已刪除" : "…")}
      color={missing ? "error" : "default"}
      sx={{ maxWidth: 220 }}
      {...chipProps}
    />
  );
}
