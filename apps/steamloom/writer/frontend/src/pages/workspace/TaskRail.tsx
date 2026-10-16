import AddIcon from "@mui/icons-material/Add";
import ChevronRightIcon from "@mui/icons-material/ChevronRight";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import SearchIcon from "@mui/icons-material/Search";
import { Box, Button, Chip, CircularProgress, Collapse, IconButton, InputAdornment, Stack, TextField, Tooltip, Typography } from "@mui/material";
import dayjs from "dayjs";
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import type { AgentTask, AgentThread } from "@writer/lib/backend.ts";

const providerNames: Record<string, string> = {
  claude: "Claude Code",
  codex: "Codex",
  grok: "Grok Build",
  gemini: "Gemini CLI",
  antigravity: "Antigravity",
};

function dateLabel(date: string, t: (key: string) => string) {
  const days = dayjs().startOf("day").diff(dayjs(date), "day");
  if (days === 0) return t("workspace.chat.dateGroups.today");
  if (days === 1) return t("workspace.chat.dateGroups.yesterday");
  if (days === 2) return t("workspace.chat.dateGroups.dayBefore");
  return date;
}

function taskState(thread: AgentThread, tasks: Record<string, AgentTask>) {
  const active = Object.values(tasks).filter((task) => task.agent_id === thread.agent_id && task.thread_id === thread.id && (task.state === "queued" || task.state === "running" || task.state === "applying"));
  // slow 只是執行中的提示（超過 TaskTimeouts.Slow），不是後端的 task 狀態。
  return active.some((task) => task.state === "applying") ? "applying" : active.some((task) => task.state === "running" && task.slow) ? "slow" : active.some((task) => task.state === "running") ? "running" : active.length > 0 ? "queued" : thread.last_task_state ?? "";
}

// 專案層級 thread rail：同一 provider 的多條 thread 都是獨立項目，不以 agent_id 合併。
export function TaskRail({ threads, tasks, selectedAgent, selectedThread, canCreate, onSelect, onDelete, onNew }: {
  threads: AgentThread[] | null;
  tasks: Record<string, AgentTask>;
  selectedAgent: string;
  selectedThread: string;
  canCreate: boolean;
  onSelect: (thread: AgentThread) => void;
  onDelete: (thread: AgentThread) => void;
  onNew: () => void;
}) {
  const { t } = useTranslation();
  const [query, setQuery] = useState("");
  const [groupOpen, setGroupOpen] = useState<Record<string, boolean>>({});
  const normalized = query.trim().toLocaleLowerCase();
  const groups = useMemo(() => {
    const grouped = new Map<string, AgentThread[]>();
    for (const thread of threads ?? []) {
      if (normalized && !(thread.title || t("workspace.chat.newThread")).toLocaleLowerCase().includes(normalized)) continue;
      const date = dayjs(thread.updated_at).format("YYYY-MM-DD");
      grouped.set(date, [...(grouped.get(date) ?? []), thread]);
    }
    return [...grouped].map(([date, items]) => ({ date, items }));
  }, [normalized, t, threads]);

  return (
    <Box sx={{ width: 280, flex: "none", borderRight: 1, borderColor: "divider", bgcolor: "action.hover", display: "flex", flexDirection: "column", minHeight: 0 }}>
      <Stack direction="row" alignItems="center" sx={{ minHeight: 52, px: 1.5, borderBottom: 1, borderColor: "divider" }}>
        <Typography fontWeight={700} sx={{ fontSize: 14 }}>{t("workspace.chat.tasks")}</Typography>
        <Box sx={{ flex: 1 }} />
        <Button size="small" startIcon={<AddIcon />} disabled={!canCreate} onClick={onNew}>{t("workspace.chat.createTask")}</Button>
      </Stack>
      <Box sx={{ px: 1, pt: 1 }}>
        <TextField
          fullWidth
          size="small"
          value={query}
          placeholder={t("workspace.chat.searchTasks")}
          slotProps={{ input: { startAdornment: <InputAdornment position="start"><SearchIcon sx={{ fontSize: 18 }} /></InputAdornment> } }}
          onChange={(event) => setQuery(event.target.value)}
          sx={{ "& input": { fontSize: 12.5 } }}
        />
      </Box>
      <Stack spacing={0.75} sx={{ p: 1, overflow: "auto" }}>
        {threads === null && <CircularProgress size={18} sx={{ alignSelf: "center", mt: 3 }} />}
        {threads?.length === 0 && <Typography color="text.secondary" sx={{ fontSize: 12.5, textAlign: "center", py: 3 }}>{t("workspace.chat.noThread")}</Typography>}
        {threads && threads.length > 0 && groups.length === 0 && <Typography color="text.secondary" sx={{ fontSize: 12.5, textAlign: "center", py: 3 }}>{t("workspace.chat.noMatchingTasks")}</Typography>}
        {groups.map(({ date, items }) => {
          const selectedInGroup = items.some((thread) => thread.agent_id === selectedAgent && thread.id === selectedThread);
          const defaultOpen = dayjs().startOf("day").diff(dayjs(date), "day") <= 3;
          const open = Boolean(normalized) || (groupOpen[date] ?? (selectedInGroup || defaultOpen));
          return (
            <Box key={date}>
              <Box
                component="button"
                onClick={() => setGroupOpen((current) => ({ ...current, [date]: !open }))}
                sx={{ width: "100%", px: 0.5, py: 0.5, display: "flex", alignItems: "center", color: "text.secondary", bgcolor: "transparent", border: 0, cursor: "pointer" }}
              >
                <ChevronRightIcon sx={{ fontSize: 17, transform: open ? "rotate(90deg)" : "none", transition: "transform 120ms" }} />
                <Typography fontWeight={700} sx={{ ml: 0.25, fontSize: 11.5 }}>{dateLabel(date, t)}</Typography>
                <Typography sx={{ ml: 0.75, fontSize: 10.5 }}>({items.length})</Typography>
              </Box>
              <Collapse in={open}>
                <Stack spacing={0.75}>
                  {items.map((thread) => {
                    const state = taskState(thread, tasks);
                    const selected = thread.agent_id === selectedAgent && thread.id === selectedThread;
                    const deletingDisabled = state === "queued" || state === "running" || state === "slow" || state === "applying";
                    return (
                      <Box
                        key={`${thread.agent_id}:${thread.id}`}
                        sx={{ position: "relative", width: "100%", color: "text.primary", bgcolor: selected ? "action.selected" : "background.paper", border: 1, borderColor: selected ? "primary.main" : "divider", borderRadius: 2, "&:hover": { bgcolor: selected ? "action.selected" : "action.hover" } }}
                      >
                        <Box
                          component="button"
                          onClick={() => onSelect(thread)}
                          sx={{ width: "100%", p: 1.25, pr: 4.5, textAlign: "left", color: "inherit", bgcolor: "transparent", border: 0, borderRadius: "inherit", cursor: "pointer", "&:focus-visible": { outline: "2px solid", outlineColor: "primary.main", outlineOffset: 1 } }}
                        >
                          <Stack direction="row" alignItems="center" spacing={0.75}>
                            {(state === "running" || state === "slow" || state === "applying") && <CircularProgress size={10} color={state === "slow" ? "warning" : "primary"} />}
                            <Typography color="text.secondary" sx={{ fontSize: 11.5 }}>{providerNames[thread.agent_id] ?? thread.agent_id}</Typography>
                            <Box sx={{ flex: 1 }} />
                            {state && <Chip size="small" color={state === "failed" || state === "apply_failed" ? "error" : state === "conflict" || state === "verification_required" || state === "slow" ? "warning" : state === "running" || state === "applying" ? "primary" : "default"} label={t(`workspace.chat.states.${state}`)} sx={{ height: 20, fontSize: 10.5 }} />}
                          </Stack>
                          <Typography noWrap fontWeight={500} sx={{ mt: 0.5, fontSize: 13 }}>{thread.title || t("workspace.chat.newThread")}</Typography>
                        </Box>
                        <Tooltip title={t("workspace.chat.deleteThread")}>
                          <span style={{ position: "absolute", top: 7, right: 7 }}>
                            <IconButton size="small" color="error" disabled={deletingDisabled} aria-label={t("workspace.chat.deleteThread")} onClick={() => onDelete(thread)} sx={{ p: 0.25 }}>
                              <DeleteOutlineIcon sx={{ fontSize: 16 }} />
                            </IconButton>
                          </span>
                        </Tooltip>
                      </Box>
                    );
                  })}
                </Stack>
              </Collapse>
            </Box>
          );
        })}
      </Stack>
    </Box>
  );
}
