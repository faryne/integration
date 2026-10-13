import type { AgentProposal, AgentProposalItem } from "@writer/lib/backend.ts";
import { ChatMessage } from "@writer/pages/workspace/ChatMessage.tsx";
import { ProposalCard } from "@writer/pages/workspace/ProposalCard.tsx";
import { TaskActivityCard } from "@writer/pages/workspace/TaskActivityCard.tsx";
import type { ChatLine } from "@writer/pages/workspace/useChatLog.ts";

const activityTypes = new Set([
  "task.queued", "task.started", "task.tool.started", "task.tool.completed", "task.completed", "task.failed", "task.canceled",
  "apply.started", "apply.completed", "apply.failed", "apply.conflict", "apply.interrupted",
]);

interface ChatTranscriptProps {
  agentID: string;
  messages: ChatLine[];
  start: number;
  proposals: AgentProposal[] | null;
  onReview: (proposal: AgentProposal, item: AgentProposalItem) => void;
}

// 同一 task 的 queued/tool/complete event 收進一張可收合 timeline，避免狀態只閃一下就消失。
export function ChatTranscript({ agentID, messages, start, proposals, onReview }: ChatTranscriptProps) {
  const activity = new Map<string, { first: number; events: ChatLine[] }>();
  messages.forEach((message, index) => {
    if (!message.task_id || !activityTypes.has(message.type ?? "")) return;
    const group = activity.get(message.task_id);
    if (group) group.events.push(message);
    else activity.set(message.task_id, { first: index, events: [message] });
  });

  return messages.map((message, index) => {
    const key = message.event_id ?? `${start}:${index}`;
    if (message.task_id && activityTypes.has(message.type ?? "")) {
      const group = activity.get(message.task_id);
      return group?.first === index ? <TaskActivityCard key={`activity:${message.task_id}`} agentID={agentID} events={group.events} /> : null;
    }
    const proposal = message.type === "proposal.ready" ? proposals?.find((item) => item.id === message.proposal_id) : undefined;
    if (proposal) return <ProposalCard key={key} proposal={proposal} onReview={(item) => onReview(proposal, item)} />;
    return <ChatMessage key={key} message={message} />;
  });
}
