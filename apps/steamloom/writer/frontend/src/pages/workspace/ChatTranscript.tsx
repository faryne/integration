import type { AgentProposal, AgentProposalItem, Workspace } from "@writer/lib/backend.ts";
import { useTranslation } from "react-i18next";
import { ChatMessage } from "@writer/pages/workspace/ChatMessage.tsx";
import { ProposalCard } from "@writer/pages/workspace/ProposalCard.tsx";
import { TaskActivityCard } from "@writer/pages/workspace/TaskActivityCard.tsx";
import { activityEventTypes, knownPersistedEvent } from "@writer/pages/workspace/chatEventRegistry.ts";
import type { ChatLine } from "@writer/pages/workspace/useChatLog.ts";

interface ChatTranscriptProps {
  agentID: string;
  messages: ChatLine[];
  start: number;
  proposals: AgentProposal[] | null;
  workspace: Workspace;
  onReview: (proposal: AgentProposal, item: AgentProposalItem, selectedItemIDs: string[]) => void;
  onConfirmApplied: (proposal: AgentProposal) => void;
  confirmingProposalID: string;
  onQuote: (message: ChatLine, messageID: string) => void;
  onViewRawOutput: (eventID: string) => void;
}

// 同一 task 的 queued/tool/complete event 收進一張可收合 timeline，避免狀態只閃一下就消失。
export function ChatTranscript({ agentID, messages, start, proposals, workspace, onReview, onConfirmApplied, confirmingProposalID, onQuote, onViewRawOutput }: ChatTranscriptProps) {
  const { t } = useTranslation();
  const activity = new Map<string, { first: number; events: ChatLine[] }>();
  messages.forEach((message, index) => {
    if (!message.task_id || !activityEventTypes.has(message.type ?? "")) return;
    const group = activity.get(message.task_id);
    if (group) group.events.push(message);
    else activity.set(message.task_id, { first: index, events: [message] });
  });

  return messages.map((message, index) => {
    const key = message.event_id ?? `${start}:${index}`;
    if (message.task_id && activityEventTypes.has(message.type ?? "")) {
      const group = activity.get(message.task_id);
      return group?.first === index ? <TaskActivityCard key={`activity:${message.task_id}`} agentID={agentID} events={group.events} workspace={workspace} onViewRawOutput={onViewRawOutput} /> : null;
    }
    const proposal = message.type === "proposal.ready" ? proposals?.find((item) => item.id === message.proposal_id) : undefined;
    if (proposal) return <ProposalCard key={key} proposal={proposal} confirming={confirmingProposalID === proposal.id} onConfirmApplied={() => onConfirmApplied(proposal)} onReview={(item, selectedItemIDs) => onReview(proposal, item, selectedItemIDs)} />;
    if (!knownPersistedEvent(message.type)) return <ChatMessage key={key} message={{ ...message, role: "system", text: `${t("workspace.chat.activity.unknown", { type: message.type || "—" })}${message.text ? `\n${message.text}` : ""}` }} />;
    const quotable = (message.role === "user" || message.role === "assistant") && message.text.trim() !== "";
    return <ChatMessage key={key} message={message} onQuote={quotable ? () => onQuote(message, message.event_id ?? `legacy:${start + index}`) : undefined} />;
  });
}
