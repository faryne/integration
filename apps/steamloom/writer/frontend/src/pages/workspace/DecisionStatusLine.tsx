import CheckCircleOutlineIcon from "@mui/icons-material/CheckCircleOutline";
import HighlightOffIcon from "@mui/icons-material/HighlightOff";
import { Stack, Typography } from "@mui/material";
import dayjs from "dayjs";
import type { ChatLine } from "@writer/pages/workspace/useChatLog.ts";

// 提案決策（核准／否決）是狀態，不是作者說的話：置中一行小字＋圖示＋時間，不用對話泡泡。
export function DecisionStatusLine({ message }: { message: ChatLine }) {
  const rejected = message.type === "proposal.rejected";
  const Icon = rejected ? HighlightOffIcon : CheckCircleOutlineIcon;
  const time = message.created_at ? dayjs(message.created_at) : null;
  return (
    <Stack direction="row" alignItems="center" justifyContent="center" gap={0.75} sx={{ color: "text.secondary", py: 0.25 }}>
      <Icon sx={{ fontSize: 15, color: rejected ? "text.disabled" : "success.main" }} />
      <Typography sx={{ fontSize: 12.5, overflowWrap: "anywhere" }}>{message.text}</Typography>
      {time?.isValid() && <Typography sx={{ fontSize: 11, color: "text.disabled", flex: "none" }}>{time.format("HH:mm")}</Typography>}
    </Stack>
  );
}
