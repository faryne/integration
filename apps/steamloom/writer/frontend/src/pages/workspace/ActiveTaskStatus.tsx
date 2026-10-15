import StopCircleOutlinedIcon from "@mui/icons-material/StopCircleOutlined";
import { CircularProgress, IconButton, Paper, Stack, Typography } from "@mui/material";
import { useTranslation } from "react-i18next";
import type { AgentTask, Workspace } from "@writer/lib/backend.ts";
import { agentActivityLabel } from "@writer/pages/workspace/agentActivity.ts";

// 同一 thread 只會有一個 running task，其餘維持 queued；不同 thread 不共用這個狀態。
export function ActiveTaskStatus({ task, workspace, queued, canceling, onCancel }: { task: AgentTask; workspace: Workspace; queued: number; canceling: boolean; onCancel: () => void }) {
  const { t } = useTranslation();
  return (
    <Stack spacing={0.75} alignItems="flex-start">
      {task.progress && (
        <Paper variant="outlined" sx={{ px: 1.5, py: 1, maxWidth: "80%", borderRadius: 2, bgcolor: "action.hover" }}>
          <Typography color="text.secondary" fontWeight={700} sx={{ mb: 0.35, fontSize: 12 }}>{t("workspace.chat.activity.progressTitle")}</Typography>
          <Typography sx={{ fontSize: 13, whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}>{task.progress}</Typography>
        </Paper>
      )}
      {task.partial && (
        <Paper variant="outlined" sx={{ px: 1.5, py: 1, maxWidth: "80%", borderRadius: 2 }}>
          <Typography sx={{ fontSize: 14, whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}>{task.partial}</Typography>
        </Paper>
      )}
      <Stack direction="row" spacing={0.75} alignItems="center" sx={{ color: "text.secondary" }}>
        <CircularProgress size={13} />
        <Typography sx={{ fontSize: 12.5 }}>
          {task.activity
            ? t("workspace.chat.taskTool", { tool: agentActivityLabel(task.activity, task.activity_target, workspace, t) })
            : task.state === "queued" ? t("workspace.chat.taskQueued") : task.state === "applying" ? t("workspace.chat.taskApplying") : t("workspace.chat.taskRunning")}
          {queued > 0 ? ` · ${t("workspace.chat.taskQueuedCount", { count: queued })}` : ""}
        </Typography>
        <IconButton size="small" color="error" disabled={canceling} aria-label={t("workspace.chat.stopTask")} onClick={onCancel}>
          <StopCircleOutlinedIcon fontSize="small" />
        </IconButton>
      </Stack>
    </Stack>
  );
}
