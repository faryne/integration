import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import SendIcon from "@mui/icons-material/Send";
import { Box, Button, CircularProgress, IconButton, MenuItem, Paper, Select, Stack, Typography } from "@mui/material";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { EventsOn } from "../../../wailsjs/runtime/runtime";
import { useSnack } from "@writer/components/SnackProvider.tsx";
import { backend, errorMessage, type AgentProposal, type AgentProposalItem, type AgentTask, type AgentTaskEvent, type AgentThread, type Workspace } from "@writer/lib/backend.ts";
import { useBackendData } from "@writer/lib/useBackendData.ts";
import { ActiveTaskStatus } from "@writer/pages/workspace/ActiveTaskStatus.tsx";
import { AgentPromptEditor } from "@writer/pages/workspace/AgentPromptEditor.tsx";
import { AssistantSetup } from "@writer/pages/workspace/AssistantSetup.tsx";
import { ProposalCard } from "@writer/pages/workspace/ProposalCard.tsx";
import { ProposalReviewDialog } from "@writer/pages/workspace/ProposalReviewDialog.tsx";
import { TaskRail } from "@writer/pages/workspace/TaskRail.tsx";
import { ThreadDeleteDialog } from "@writer/pages/workspace/ThreadDeleteDialog.tsx";
import { useChatLog } from "@writer/pages/workspace/useChatLog.ts";

// 專案層的 AI 助理。每條 thread 各自綁定 provider session，同一 provider 也能同時執行多條。
export function ChatPanel({ projectID, projectName, workspace }: { projectID: string; projectName: string; workspace: Workspace }) {
  const { t } = useTranslation();
  const { showError } = useSnack();
  const agents = useBackendData(() => backend.Agents(), []);
  const [agentID, setAgentID] = useState("");
  const [draft, setDraft] = useState("");
  const [starting, setStarting] = useState(false);
  const [canceling, setCanceling] = useState("");
  const [tasks, setTasks] = useState<Record<string, AgentTask>>({});
  const [threads, setThreads] = useState<AgentThread[] | null>(null);
  const [pendingThread, setPendingThread] = useState<AgentThread | null>(null);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [proposals, setProposals] = useState<AgentProposal[] | null>(null);
  const [proposalRevision, setProposalRevision] = useState(0);
  const [review, setReview] = useState<{ proposal: AgentProposal; item: AgentProposalItem } | null>(null);
  const [deciding, setDeciding] = useState(false);
  const selected = agents?.some((agent) => agent.id === agentID) ? agentID : (agents?.[0]?.id ?? "");
  const chat = useChatLog(projectID, selected);
  const activeTasks = useMemo(
    () => Object.values(tasks).filter((task) => task.agent_id === selected && task.thread_id === chat.page?.current_id && (task.state === "queued" || task.state === "running" || task.state === "applying")),
    [chat.page?.current_id, selected, tasks],
  );
  const activeTask = activeTasks.find((task) => task.state === "applying" || task.state === "running") ?? activeTasks[0];

  const loadThreads = useCallback(async () => {
    try {
      setThreads(await backend.ChatThreads(projectID));
    } catch (err) {
      showError(errorMessage(err));
    }
  }, [projectID, showError]);

  useEffect(() => {
    void loadThreads();
  }, [loadThreads]);

  useEffect(() => {
    let canceled = false;
    setReview(null);
    if (!selected || !chat.page?.current_id) {
      setProposals(null);
      return;
    }
    setProposals(null);
    backend.ChatProposals(selected, projectID, chat.page.current_id)
      .then((next) => { if (!canceled) setProposals(next); })
      .catch((err) => { if (!canceled) showError(errorMessage(err)); });
    return () => { canceled = true; };
  }, [chat.page?.current_id, projectID, proposalRevision, selected, showError]);

  useEffect(() => EventsOn("agent:task", (event: AgentTaskEvent) => {
    if (event.task.project_id !== projectID) return;
    setTasks((current) => ({ ...current, [event.task.id]: event.task }));
    if (event.type.startsWith("task.") || event.type.startsWith("apply.") || event.type === "proposal.ready") {
      void loadThreads();
      if (event.task.agent_id === selected) {
        void chat.refreshVisibleThread(event.task.thread_id);
        if ((event.type === "proposal.ready" || event.type.startsWith("apply.")) && event.task.thread_id === chat.page?.current_id) setProposalRevision((value) => value + 1);
      }
    }
    if ((event.type === "task.failed" || event.type === "apply.failed") && (event.task.agent_id !== selected || event.task.thread_id !== chat.page?.current_id)) {
      showError(`${event.task.agent_id}: ${event.task.error}`);
    }
  }), [chat.page?.current_id, chat.refreshVisibleThread, loadThreads, projectID, selected, showError]);

  // 切換 provider 後要等 useChatLog 開好該 provider 的 index，才能選指定 thread。
  useEffect(() => {
    if (!pendingThread || pendingThread.agent_id !== selected || chat.page === null) return;
    const thread = pendingThread;
    setPendingThread(null);
    void chat.openThread(thread.id);
  }, [chat.openThread, chat.page, pendingThread, selected]);

  const selectProjectThread = (thread: AgentThread) => {
    setDeleteOpen(false);
    if (thread.agent_id === selected) {
      void chat.openThread(thread.id);
      return;
    }
    setPendingThread(thread);
    setAgentID(thread.agent_id);
  };

  const startNew = async () => {
    setPendingThread(null);
    if (await chat.startNew()) await loadThreads();
  };

  const send = async () => {
    const prompt = draft.trim();
    if (!prompt || !selected || starting || chat.page === null) return;
    setStarting(true);
    try {
      const task = await backend.StartTask(selected, {
        thread_id: chat.page.current_id,
        session_id: "",
        project_id: projectID,
        kind: "",
        document_id: "",
        title: projectName,
        prompt,
      });
      setDraft("");
      setTasks((current) => ({ ...current, [task.id]: task }));
      await chat.openThread(task.thread_id);
      await loadThreads();
    } catch (err) {
      showError(errorMessage(err));
    } finally {
      setStarting(false);
    }
  };

  const cancelTask = async () => {
    if (!activeTask || canceling) return;
    setCanceling(activeTask.id);
    try {
      await backend.CancelTask(activeTask.id);
    } catch (err) {
      showError(errorMessage(err));
    } finally {
      setCanceling("");
    }
  };

  const deleteThread = async () => {
    setDeleting(true);
    if (await chat.deleteCurrent()) {
      setDeleteOpen(false);
      await loadThreads();
    }
    setDeleting(false);
  };

  const decideProposal = async (decision: "approve" | "reject") => {
    if (!review || !selected || !chat.page?.current_id || deciding) return;
    const threadID = chat.page.current_id;
    setDeciding(true);
    try {
      await backend.DecideProposal(selected, projectID, threadID, review.proposal.id, decision);
      setReview(null);
      setProposalRevision((value) => value + 1);
      await Promise.all([chat.refreshVisibleThread(threadID), loadThreads()]);
    } catch (err) {
      showError(errorMessage(err));
    } finally {
      setDeciding(false);
    }
  };

  return (
    <Box sx={{ flex: 1, minHeight: 0, display: "flex" }}>
      <TaskRail
        threads={threads}
        tasks={tasks}
        selectedAgent={selected}
        selectedThread={chat.page?.current_id ?? ""}
        canCreate={Boolean(selected && chat.page !== null)}
        onSelect={selectProjectThread}
        onNew={() => void startNew()}
      />
      <Box sx={{ flex: 1, minWidth: 0, minHeight: 0, display: "flex", flexDirection: "column" }}>
        <Box ref={chat.box} sx={{ flex: 1, overflow: "auto" }}>
        <Stack spacing={1.25} sx={{ maxWidth: 780, mx: "auto", px: 2.5, py: 2.5 }}>
          {selected && <AssistantSetup agentID={selected} />}
          {agents?.length === 0 && (
            <Typography color="text.secondary" sx={{ fontSize: 13.5, textAlign: "center", pt: 6 }}>
              {t("workspace.chat.noAgent")}
            </Typography>
          )}
          {chat.page && chat.page.start > 0 && (
            <Button size="small" disabled={chat.loadingOlder} onClick={() => void chat.loadOlder()} sx={{ alignSelf: "center" }}>
              {chat.loadingOlder ? <CircularProgress size={14} /> : t("workspace.chat.older")}
            </Button>
          )}
          {chat.page === null && selected && <CircularProgress size={18} sx={{ alignSelf: "center", mt: 4 }} />}
          {chat.page?.messages.map((message, index) => {
            const system = message.role === "system";
            const proposal = message.type === "proposal.ready" ? proposals?.find((item) => item.id === message.proposal_id) : undefined;
            if (proposal) {
              return <ProposalCard key={message.event_id ?? `${chat.page?.start ?? 0}:${index}`} proposal={proposal} onReview={(item) => setReview({ proposal, item })} />;
            }
            return (
            <Box key={`${chat.page?.start ?? 0}:${index}`} sx={{ display: "flex", justifyContent: system ? "center" : message.role === "user" ? "flex-end" : "flex-start" }}>
              <Paper
                variant="outlined"
                sx={{ px: 1.5, py: 1, maxWidth: system ? "100%" : "80%", borderRadius: 2, bgcolor: system ? "action.hover" : message.role === "user" ? "action.selected" : "transparent" }}
              >
                <Typography color={system ? "text.secondary" : "text.primary"} sx={{ fontSize: system ? 12.5 : 14, whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}>{message.text}</Typography>
              </Paper>
            </Box>
          )})}
          {activeTask && <ActiveTaskStatus task={activeTask} queued={Math.max(0, activeTasks.length - 1)} canceling={canceling === activeTask.id} onCancel={() => void cancelTask()} />}
        </Stack>
        </Box>
        <Box sx={{ px: 2.5, pt: 1.25, pb: 2.25 }}>
        <Paper variant="outlined" sx={{ maxWidth: 780, mx: "auto", px: 1.5, pt: 1.25, pb: 1, borderRadius: 3, "&:focus-within": { borderColor: "primary.main" } }}>
          <AgentPromptEditor
            workspace={workspace}
            value={draft}
            disabled={!selected}
            onChange={setDraft}
            onSubmit={() => void send()}
          />
          <Stack direction="row" alignItems="center" spacing={1} sx={{ mt: 1 }}>
            <Select
              size="small"
              displayEmpty
              value={selected}
              disabled={!agents?.length}
              onChange={(e) => {
                setPendingThread(null);
                setAgentID(e.target.value);
              }}
              sx={{ fontSize: 12.5, "& .MuiSelect-select": { py: 0.5 } }}
            >
              {!agents?.length && (
                <MenuItem value="" sx={{ fontSize: 13 }}>
                  {agents === null ? t("workspace.chat.detecting") : t("workspace.chat.noAgent")}
                </MenuItem>
              )}
              {agents?.map((agent) => (
                <MenuItem key={agent.id} value={agent.id} sx={{ fontSize: 13 }}>
                  {agent.display_name}
                </MenuItem>
              ))}
            </Select>
            <IconButton
              size="small"
              color="error"
              disabled={!chat.page?.current_id || activeTasks.length > 0}
              aria-label={t("workspace.chat.deleteThread")}
              onClick={() => setDeleteOpen(true)}
            >
              <DeleteOutlineIcon fontSize="small" />
            </IconButton>
            <Box sx={{ flex: 1 }} />
            <IconButton color="primary" disabled={!selected || starting || chat.page === null || !draft.trim()} aria-label={t("workspace.chat.send")} onClick={() => void send()}>
              {starting ? <CircularProgress size={16} /> : <SendIcon fontSize="small" />}
            </IconButton>
          </Stack>
        </Paper>
        </Box>
      </Box>
      <ThreadDeleteDialog open={deleteOpen} deleting={deleting} onClose={() => setDeleteOpen(false)} onDelete={() => void deleteThread()} />
      <ProposalReviewDialog
        agentID={selected}
        projectID={projectID}
        threadID={chat.page?.current_id ?? ""}
        proposal={review?.proposal ?? null}
        item={review?.item ?? null}
        deciding={deciding}
        onClose={() => setReview(null)}
        onDecision={(decision) => void decideProposal(decision)}
      />
    </Box>
  );
}
