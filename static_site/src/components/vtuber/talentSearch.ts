import type { VtuberChannelSummary } from "@/types/vtubers.ts";

// 名稱、@handle、期別名稱都能搜（不分大小寫）；空字串視為全部符合
export function matchesTalent(
  channel: VtuberChannelSummary,
  keyword: string,
  unitName: string,
) {
  const q = keyword.trim().toLowerCase();
  return (
    !q ||
    `${channel.title} ${channel.handle} ${unitName}`.toLowerCase().includes(q)
  );
}
