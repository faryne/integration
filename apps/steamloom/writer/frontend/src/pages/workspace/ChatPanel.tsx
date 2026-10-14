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
import { ChatTranscript } from "@writer/pages/workspace/ChatTranscript.tsx";
import { ChatThreadHeader } from "@writer/pages/workspace/ChatThreadHeader.tsx";
import { ChatTaskLanding } from "@writer/pages/workspace/ChatTaskLanding.tsx";
import { ProposalReviewDialog } from "@writer/pages/workspace/ProposalReviewDialog.tsx";
import { TaskRail } from "@writer/pages/workspace/TaskRail.tsx";
import { ThreadDeleteDialog } from "@writer/pages/workspace/ThreadDeleteDialog.tsx";
import { useChatLog } from "@writer/pages/workspace/useChatLog.ts";

// 專案層的 AI 助理。每條 thread 各自綁定 provider session，同一 provider 也能同時執行多條。
export function ChatPanel({ projectID, projectName, workspace, onWorkspaceChange }: { projectID: string; projectName: string; workspace: Workspace; onWorkspaceChange: () => void }) {
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
  const [deleteTarget, setDeleteTarget] = useState<AgentThread | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [proposals, setProposals] = useState<AgentProposal[] | null>(null);
  const [proposalRevision, setProposalRevision] = useState(0);
  const [review, setReview] = useState<{ proposal: AgentProposal; item: AgentProposalItem; selectedItemIDs: string[] } | null>(null);
  const [deciding, setDeciding] = useState(false);
  const [viewMode, setViewMode] = useState<"empty" | "new" | "thread">("empty");
  const selected = agents?.some((agent) => agent.id === agentID) ? agentID : (agents?.[0]?.id ?? "");
  const chat = useChatLog(projectID, selected);
  const currentThreadID = viewMode === "thread" ? (chat.page?.current_id ?? "") : "";
  const activeTasks = useMemo(
    () => Object.values(tasks).filter((task) => task.agent_id === selected && task.thread_id === currentThreadID && (task.state === "queued" || task.state === "running" || task.state === "applying")),
    [currentThreadID, selected, tasks],
  );
  const activeTask = activeTasks.find((task) => task.state === "applying" || task.state === "running") ?? activeTasks[0];
  const currentTitle = chat.page?.threads.find((thread) => thread.id === currentThreadID)?.title || t("workspace.chat.newThread");
  const agentLocked = viewMode === "thread" || starting || Boolean(pendingThread);

  useEffect(() => {
    setViewMode("empty");
    setPendingThread(null);
    setDraft("");
  }, [projectID]);

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
    if (!selected || !currentThreadID) {
      setProposals(null);
      return;
    }
    setProposals(null);
    backend.ChatProposals(selected, projectID, currentThreadID)
      .then((next) => { if (!canceled) setProposals(next); })
      .catch((err) => { if (!canceled) showError(errorMessage(err)); });
    return () => { canceled = true; };
  }, [currentThreadID, projectID, proposalRevision, selected, showError]);

  useEffect(() => EventsOn("agent:task", (event: AgentTaskEvent) => {
    if (event.task.project_id !== projectID) return;
    setTasks((current) => ({ ...current, [event.task.id]: event.task }));
    if (event.type.startsWith("task.") || event.type.startsWith("tool.") || event.type.startsWith("apply.") || event.type === "proposal.ready") {
      void loadThreads();
      if (event.task.agent_id === selected && viewMode === "thread") {
        void chat.refreshVisibleThread(event.task.thread_id);
        if ((event.type === "proposal.ready" || event.type.startsWith("apply.")) && event.task.thread_id === currentThreadID) setProposalRevision((value) => value + 1);
      }
    }
    if (event.type === "apply.completed") onWorkspaceChange();
    if ((event.type === "task.failed" || event.type === "apply.failed") && (event.task.agent_id !== selected || event.task.thread_id !== currentThreadID)) {
      showError(`${event.task.agent_id}: ${event.task.error}`);
    }
  }), [chat.refreshVisibleThread, currentThreadID, loadThreads, onWorkspaceChange, projectID, selected, showError, viewMode]);

  // 切換 provider 後要等 useChatLog 開好該 provider 的 index，才能選指定 thread。
  useEffect(() => {
    if (!pendingThread || pendingThread.agent_id !== selected || chat.page === null) return;
    const thread = pendingThread;
    setPendingThread(null);
    void chat.openThread(thread.id).then((result) => {
      if (result === "opened") setViewMode("thread");
      if (result === "missing") setThreads((current) => current?.filter((item) => item.agent_id !== thread.agent_id || item.id !== thread.id) ?? null);
    });
  }, [chat.openThread, chat.page, pendingThread, selected]);

  const selectProjectThread = (thread: AgentThread) => {
    setDeleteTarget(null);
    setViewMode("empty");
    if (thread.agent_id === selected) {
      void chat.openThread(thread.id).then((result) => {
        if (result === "opened") setViewMode("thread");
        if (result === "missing") setThreads((current) => current?.filter((item) => item.agent_id !== thread.agent_id || item.id !== thread.id) ?? null);
      });
      return;
    }
    setPendingThread(thread);
    setAgentID(thread.agent_id);
  };

  const startNew = () => {
    setPendingThread(null);
    setReview(null);
    setDraft("");
    setViewMode("new");
  };

  const renameThread = async (title: string) => {
    if (!(await chat.renameCurrent(title))) return false;
    await loadThreads();
    return true;
  };

  const send = async () => {
    const prompt = draft.trim();
    if (!prompt || !selected || starting || (viewMode === "thread" && !currentThreadID)) return;
    setStarting(true);
    try {
      const task = await backend.StartTask(selected, {
        thread_id: currentThreadID,
        session_id: "",
        project_id: projectID,
        kind: "",
        document_id: "",
        title: projectName,
        prompt,
      });
      setDraft("");
      setTasks((current) => ({ ...current, [task.id]: task }));
      if (await chat.openThread(task.thread_id) === "opened") setViewMode("thread");
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
    if (!deleteTarget) return;
    setDeleting(true);
    let deleted = false;
    if (deleteTarget.agent_id === selected) {
      deleted = await chat.deleteThread(deleteTarget.id);
    } else {
      try {
        await backend.ChatDelete(deleteTarget.agent_id, projectID, deleteTarget.id);
        deleted = true;
      } catch (err) {
        showError(errorMessage(err));
      }
    }
    if (deleted) {
      if (deleteTarget.agent_id === selected && deleteTarget.id === currentThreadID) setViewMode("empty");
      setPendingThread((current) => current?.id === deleteTarget.id && current.agent_id === deleteTarget.agent_id ? null : current);
      setDeleteTarget(null);
      await loadThreads();
    }
    setDeleting(false);
  };

  const decideProposal = async (decision: "approve" | "reject") => {
    if (!review || !selected || !currentThreadID || deciding) return;
    const threadID = currentThreadID;
    setDeciding(true);
    try {
      await backend.DecideProposal(selected, projectID, threadID, review.proposal.id, decision, review.selectedItemIDs);
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
        selectedThread={currentThreadID}
        canCreate={Boolean(selected)}
        onSelect={selectProjectThread}
        onDelete={setDeleteTarget}
        onNew={startNew}
      />
      <Box sx={{ flex: 1, minWidth: 0, minHeight: 0, display: "flex", flexDirection: "column" }}>
        {viewMode === "empty" && <ChatTaskLanding canCreate={Boolean(selected)} onCreate={startNew} />}
        {viewMode === "thread" && <ChatThreadHeader threadID={currentThreadID} title={currentTitle} onSave={renameThread} />}
        {viewMode !== "empty" && (
        <>
        <Box ref={chat.box} sx={{ flex: 1, overflow: "auto" }}>
        <Stack spacing={1.25} sx={{ maxWidth: 780, mx: "auto", px: 2.5, py: 2.5 }}>
          {viewMode === "new" && <ChatTaskLanding creating />}
          {selected && <AssistantSetup agentID={selected} />}
          {agents?.length === 0 && (
            <Typography color="text.secondary" sx={{ fontSize: 13.5, textAlign: "center", pt: 6 }}>
              {t("workspace.chat.noAgent")}
            </Typography>
          )}
          {viewMode === "thread" && chat.page && chat.page.start > 0 && (
            <Button size="small" disabled={chat.loadingOlder} onClick={() => void chat.loadOlder()} sx={{ alignSelf: "center" }}>
              {chat.loadingOlder ? <CircularProgress size={14} /> : t("workspace.chat.older")}
            </Button>
          )}
          {viewMode === "thread" && chat.page === null && selected && <CircularProgress size={18} sx={{ alignSelf: "center", mt: 4 }} />}
          {viewMode === "thread" && chat.page && (
            <ChatTranscript
              agentID={selected}
              messages={chat.page.messages}
              start={chat.page.start}
              proposals={proposals}
              workspace={workspace}
              onReview={(proposal, item, selectedItemIDs) => setReview({ proposal, item, selectedItemIDs })}
            />
          )}
          {activeTask && <ActiveTaskStatus task={activeTask} workspace={workspace} queued={Math.max(0, activeTasks.length - 1)} canceling={canceling === activeTask.id} onCancel={() => void cancelTask()} />}
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
              disabled={!agents?.length || agentLocked}
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
            <Box sx={{ flex: 1 }} />
            <IconButton color="primary" disabled={!selected || starting || (viewMode === "thread" && !currentThreadID) || !draft.trim()} aria-label={t("workspace.chat.send")} onClick={() => void send()}>
              {starting ? <CircularProgress size={16} /> : <SendIcon fontSize="small" />}
            </IconButton>
          </Stack>
        </Paper>
        </Box>
        </>
        )}
      </Box>
      <ThreadDeleteDialog open={deleteTarget !== null} deleting={deleting} onClose={() => setDeleteTarget(null)} onDelete={() => void deleteThread()} />
      <ProposalReviewDialog
        agentID={selected}
        projectID={projectID}
        threadID={currentThreadID}
        proposal={review?.proposal ?? null}
        item={review?.item ?? null}
        selectedCount={review?.selectedItemIDs.length ?? 0}
        deciding={deciding}
        onClose={() => setReview(null)}
        onDecision={(decision) => void decideProposal(decision)}
      />
    </Box>
  );
}
