import AddIcon from "@mui/icons-material/Add";
import { Box, Button, Chip, CircularProgress, Stack, Typography } from "@mui/material";
import { useTranslation } from "react-i18next";
import type { AgentTask, AgentThread } from "@writer/lib/backend.ts";

const providerNames: Record<string, string> = { claude: "Claude Code", codex: "Codex", grok: "Grok Builds" };

function taskState(thread: AgentThread, tasks: Record<string, AgentTask>) {
  const active = Object.values(tasks).filter((task) => task.agent_id === thread.agent_id && task.thread_id === thread.id && (task.state === "queued" || task.state === "running" || task.state === "applying"));
  return active.some((task) => task.state === "applying") ? "applying" : active.some((task) => task.state === "running") ? "running" : active.length > 0 ? "queued" : thread.last_task_state ?? "";
}

// 專案層級 thread rail：同一 provider 的多條 thread 都是獨立項目，不以 agent_id 合併。
export function TaskRail({ threads, tasks, selectedAgent, selectedThread, canCreate, onSelect, onNew }: {
  threads: AgentThread[] | null;
  tasks: Record<string, AgentTask>;
  selectedAgent: string;
  selectedThread: string;
  canCreate: boolean;
  onSelect: (thread: AgentThread) => void;
  onNew: () => void;
}) {
  const { t } = useTranslation();
  return (
    <Box sx={{ width: 280, flex: "none", borderRight: 1, borderColor: "divider", bgcolor: "action.hover", display: "flex", flexDirection: "column", minHeight: 0 }}>
      <Stack direction="row" alignItems="center" sx={{ minHeight: 52, px: 1.5, borderBottom: 1, borderColor: "divider" }}>
        <Typography fontWeight={700} sx={{ fontSize: 14 }}>{t("workspace.chat.tasks")}</Typography>
        <Box sx={{ flex: 1 }} />
        <Button size="small" startIcon={<AddIcon />} disabled={!canCreate} onClick={onNew}>{t("workspace.chat.newThread")}</Button>
      </Stack>
      <Stack spacing={0.75} sx={{ p: 1, overflow: "auto" }}>
        {threads === null && <CircularProgress size={18} sx={{ alignSelf: "center", mt: 3 }} />}
        {threads?.length === 0 && <Typography color="text.secondary" sx={{ fontSize: 12.5, textAlign: "center", py: 3 }}>{t("workspace.chat.noThread")}</Typography>}
        {threads?.map((thread) => {
          const state = taskState(thread, tasks);
          const selected = thread.agent_id === selectedAgent && thread.id === selectedThread;
          return (
            <Box
              component="button"
              key={`${thread.agent_id}:${thread.id}`}
              onClick={() => onSelect(thread)}
              sx={{ width: "100%", p: 1.25, textAlign: "left", color: "text.primary", bgcolor: selected ? "action.selected" : "background.paper", border: 1, borderColor: selected ? "primary.main" : "divider", borderRadius: 2, cursor: "pointer" }}
            >
              <Stack direction="row" alignItems="center" spacing={0.75}>
                {(state === "running" || state === "applying") && <CircularProgress size={10} />}
                <Typography color="text.secondary" sx={{ fontSize: 11.5 }}>{providerNames[thread.agent_id] ?? thread.agent_id}</Typography>
                <Box sx={{ flex: 1 }} />
                {state && <Chip size="small" color={state === "failed" || state === "apply_failed" ? "error" : state === "conflict" || state === "verification_required" ? "warning" : state === "running" || state === "applying" ? "primary" : "default"} label={t(`workspace.chat.states.${state}`)} sx={{ height: 20, fontSize: 10.5 }} />}
              </Stack>
              <Typography noWrap fontWeight={500} sx={{ mt: 0.5, fontSize: 13 }}>{thread.title || t("workspace.chat.newThread")}</Typography>
            </Box>
          );
        })}
      </Stack>
    </Box>
  );
}
