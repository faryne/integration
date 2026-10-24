import { Chip } from "@mui/material";

import { LIVE_STATUS_LABELS } from "@/components/vtuber/format.ts";
import type { VtuberLiveStatus } from "@/types/vtubers.ts";

const STATUS_COLORS: Record<VtuberLiveStatus, "primary" | "error" | "default"> =
  {
    upcoming: "primary",
    live: "error",
    ended: "default",
    cancelled: "default",
  };

/** 直播狀態小標籤：待機中、直播中實心，已結束、已取消外框；時間軸與影片 modal 共用 */
export function LiveStatusChip({ status }: { status: VtuberLiveStatus }) {
  return (
    <Chip
      size={"small"}
      variant={
        status === "upcoming" || status === "live" ? "filled" : "outlined"
      }
      color={STATUS_COLORS[status]}
      label={LIVE_STATUS_LABELS[status]}
      sx={{ flexShrink: 0 }}
    />
  );
}
