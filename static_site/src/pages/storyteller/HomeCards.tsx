import AutoStoriesIcon from "@mui/icons-material/AutoStories";
import DeleteIcon from "@mui/icons-material/Delete";
import EditIcon from "@mui/icons-material/Edit";
import LockIcon from "@mui/icons-material/Lock";
import PeopleIcon from "@mui/icons-material/People";
import PublicIcon from "@mui/icons-material/Public";
import SmartToyIcon from "@mui/icons-material/SmartToy";
import {
  Alert,
  Button,
  Chip,
  Grid,
  Paper,
  Stack,
  ToggleButton,
  ToggleButtonGroup,
  Tooltip,
  Typography,
} from "@mui/material";
import { useState } from "react";
import { Link as RouterLink } from "react-router-dom";
import {
  useDeleteStorytellerAgent,
  useDeleteStorytellerProject,
  useSaveStorytellerProject,
  useStorytellerProviderAPIKeys,
} from "@/apis/storyteller.ts";
import { ConfirmNameDialog } from "@/components/common/ConfirmNameDialog.tsx";
import { CustomEmptyState } from "@/components/common/CustomEmptyState.tsx";
import { formatStorytellerDate } from "@/data/storyteller.ts";
import { steamloomPath } from "@/helpers/steamloom.ts";
import { StorytellerProjectCard } from "@/pages/storyteller/StorytellerProjectCard.tsx";
import type {
  StorytellerAgent,
  StorytellerProject,
} from "@/types/storyteller.ts";

const agentPromptSummaryLength = 120;

function agentPromptPlainTextSummary(prompt: string) {
  // AI Agent 卡片只顯示 Prompt 摘要，避免 Markdown 或 HTML-like 語法影響列表掃描。
  const plainText = prompt
    .replace(/<[^>]*>/g, " ")
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/\[([^\]]+)]\([^)]+\)/g, "$1")
    .replace(/[*_~>#|\-[\]]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (!plainText) {
    return "未設定 Prompt 摘要。";
  }
  const characters = Array.from(plainText);
  return characters.length > agentPromptSummaryLength
    ? `${characters.slice(0, agentPromptSummaryLength).join("")}...`
    : plainText;
}

export function ProjectCards({ projects }: { projects: StorytellerProject[] }) {
  const deleteProject = useDeleteStorytellerProject();
  const [deleteTarget, setDeleteTarget] = useState<{
    id: string;
    name: string;
  } | null>(null);
  const saveProject = useSaveStorytellerProject();

  function handleVisibilityChange(
    project: StorytellerProject,
    visibility: StorytellerProject["visibility"] | null,
  ) {
    if (!visibility || visibility === project.visibility) {
      return;
    }
    saveProject.mutate({
      publicId: project.public_id,
      input: {
        name: project.name,
        slug: project.slug,
        description: project.description,
        visibility,
        rating: project.rating,
        content_type: project.content_type,
        tags: project.tags ?? [],
      },
    });
  }

  return (
    <>
      {deleteProject.isError && (
        <Alert severity="error" variant="outlined" sx={{ mb: 2 }}>
          刪除專案失敗，請確認登入狀態後再試一次。
        </Alert>
      )}
      {projects.length === 0 ? (
        <CustomEmptyState
          icon={<AutoStoriesIcon fontSize="large" />}
          title="目前還沒有創作專案"
          description="可以使用上方的「建立專案」開始建立第一個創作專案。"
        />
      ) : (
        <Grid container spacing={2}>
          {projects.map((project) => (
            <Grid key={project.public_id} size={{ xs: 12, md: 4 }}>
              <StorytellerProjectCard
                project={project}
                headerAction={
                  <ToggleButtonGroup
                    size="small"
                    exclusive
                    value={project.visibility}
                    disabled={saveProject.isPending}
                    onChange={(_, value) =>
                      handleVisibilityChange(project, value)
                    }
                  >
                    <ToggleButton value="private">
                      <Tooltip title="完全不公開">
                        <LockIcon fontSize="small" />
                      </Tooltip>
                    </ToggleButton>
                    <ToggleButton value="unlisted">
                      <Tooltip title="與親友分享">
                        <PeopleIcon fontSize="small" />
                      </Tooltip>
                    </ToggleButton>
                    <ToggleButton value="public">
                      <Tooltip title="已公開">
                        <PublicIcon fontSize="small" />
                      </Tooltip>
                    </ToggleButton>
                  </ToggleButtonGroup>
                }
                actions={
                  <>
                    <Button
                      component={RouterLink}
                      to={steamloomPath(`my/workspace/${project.public_id}`)}
                      size="small"
                      variant="outlined"
                    >
                      開啟專案
                    </Button>
                    <Button
                      component={RouterLink}
                      to={steamloomPath(
                        `my/workspace/${project.public_id}/edit`,
                      )}
                      size="small"
                      variant="outlined"
                      startIcon={<EditIcon />}
                    >
                      編輯
                    </Button>
                    <Button
                      size="small"
                      color="error"
                      variant="contained"
                      startIcon={<DeleteIcon />}
                      onClick={() =>
                        setDeleteTarget({
                          id: project.public_id,
                          name: project.name,
                        })
                      }
                    >
                      刪除
                    </Button>
                  </>
                }
              />
            </Grid>
          ))}
        </Grid>
      )}
      {deleteTarget && (
        <ConfirmNameDialog
          open
          title="刪除專案"
          description="刪除後會移除專案與底下故事資料。請輸入專案名稱確認。"
          confirmName={deleteTarget.name}
          confirmLabel="刪除專案"
          loading={deleteProject.isPending}
          onClose={() => setDeleteTarget(null)}
          onConfirm={() => {
            deleteProject.mutate(deleteTarget.id, {
              onSuccess: () => setDeleteTarget(null),
            });
          }}
        />
      )}
    </>
  );
}

export function AgentCards({ agents }: { agents: StorytellerAgent[] }) {
  const deleteAgent = useDeleteStorytellerAgent();
  const { data: apiKeys = [] } = useStorytellerProviderAPIKeys();
  const [deleteTarget, setDeleteTarget] = useState<{
    id: number;
    name: string;
    apiBacked: boolean;
  } | null>(null);
  const rows = agents.map((agent) => ({
    id: agent.id,
    name: agent.name,
    promptSummary: agentPromptPlainTextSummary(agent.default_prompt),
    provider: agent.provider,
    model: agent.model_name,
    enabled: !agent.is_deleted,
    apiKeyLabel:
      apiKeys.find((apiKey) => apiKey.id === agent.provider_apikey_id)?.label ??
      null,
    updatedAt: agent.updated_at,
    apiBacked: true,
  }));

  return (
    <>
      {rows.length === 0 ? (
        <CustomEmptyState
          icon={<SmartToyIcon fontSize="large" />}
          title="目前還沒有 AI Agent"
          description="可以使用上方的「建立 AI Agent」新增可在故事編輯器中使用的 Agent。"
        />
      ) : (
        <Grid container spacing={2}>
          {rows.map((agent) => (
            <Grid key={agent.id} size={{ xs: 12, md: 4 }}>
              <Paper
                variant="outlined"
                sx={{
                  p: 2,
                  borderRadius: 1,
                  height: 1,
                  boxSizing: "border-box",
                  overflow: "hidden",
                }}
              >
                <Stack spacing={1.5} sx={{ height: 1, minWidth: 0 }}>
                  <Stack
                    direction="row"
                    spacing={1}
                    alignItems="center"
                    sx={{ minWidth: 0 }}
                  >
                    <SmartToyIcon
                      color={agent.enabled ? "primary" : "disabled"}
                    />
                    <Typography
                      variant="h6"
                      fontWeight={800}
                      sx={{ minWidth: 0, overflowWrap: "anywhere" }}
                    >
                      {agent.name}
                    </Typography>
                  </Stack>
                  <Typography
                    color="text.secondary"
                    sx={{ flex: 1, minWidth: 0, overflowWrap: "anywhere" }}
                  >
                    {agent.promptSummary}
                  </Typography>
                  <Stack
                    direction="row"
                    spacing={1}
                    flexWrap="wrap"
                    useFlexGap
                    sx={{ minWidth: 0 }}
                  >
                    <Chip size="small" label={agent.provider} />
                    <Chip size="small" label={agent.model} />
                    {agent.apiKeyLabel ? (
                      <Chip size="small" label={`Key：${agent.apiKeyLabel}`} />
                    ) : (
                      <Chip
                        size="small"
                        color="warning"
                        label="未綁定 API Key"
                      />
                    )}
                  </Stack>
                  <Typography variant="caption" color="text.secondary">
                    更新於 {formatStorytellerDate(agent.updatedAt)}
                  </Typography>
                  <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                    <Button
                      component={RouterLink}
                      to={steamloomPath(`my/agent/${agent.id}/edit`)}
                      size="small"
                      variant="outlined"
                      startIcon={<EditIcon />}
                      disabled={!agent.apiBacked}
                    >
                      編輯
                    </Button>
                    <Button
                      size="small"
                      color="error"
                      variant="contained"
                      startIcon={<DeleteIcon />}
                      disabled={!agent.apiBacked}
                      onClick={() =>
                        setDeleteTarget({
                          id: Number(agent.id),
                          name: agent.name,
                          apiBacked: agent.apiBacked,
                        })
                      }
                    >
                      刪除
                    </Button>
                  </Stack>
                </Stack>
              </Paper>
            </Grid>
          ))}
        </Grid>
      )}
      {deleteTarget && (
        <ConfirmNameDialog
          open
          title="刪除 AI Agent"
          description="刪除後此 Agent 將無法在故事編輯器中使用。請輸入 Agent 名稱確認。"
          confirmName={deleteTarget.name}
          confirmLabel="刪除 Agent"
          loading={deleteAgent.isPending}
          onClose={() => setDeleteTarget(null)}
          onConfirm={() => {
            if (!deleteTarget.apiBacked) {
              setDeleteTarget(null);
              return;
            }
            deleteAgent.mutate(deleteTarget.id, {
              onSuccess: () => setDeleteTarget(null),
            });
          }}
        />
      )}
    </>
  );
}
