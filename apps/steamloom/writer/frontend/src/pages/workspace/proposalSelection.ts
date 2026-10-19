import type { AgentProposal } from "@writer/lib/backend.ts";

// 一般提案以 item 為套用單位；批次圖片則每張 artifact 都是獨立的套用結果。
export function countSelectedProposalResults(proposal: AgentProposal, selectedIDs: string[]) {
  const selected = new Set(selectedIDs);
  return proposal.items.reduce((count, item) => {
    if (!selected.has(item.id)) return count;
    return count + (item.artifacts?.length ? item.artifacts.filter((artifact) => selected.has(artifact.id)).length : 1);
  }, 0);
}
