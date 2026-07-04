import DeleteIcon from "@mui/icons-material/Delete";
import EditIcon from "@mui/icons-material/Edit";
import SmartToyIcon from "@mui/icons-material/SmartToy";
import AutoStoriesIcon from "@mui/icons-material/AutoStories";
import {
  Box,
  Alert,
  Button,
  Chip,
  Divider,
  Grid,
  Paper,
  Stack,
  Tab,
  Tabs,
  Typography,
} from "@mui/material";
import { useEffect, useState } from "react";
import { Link as RouterLink, useLocation, useNavigate } from "react-router-dom";
import {
  useDeleteStorytellerAgent,
  useDeleteStorytellerProject,
  useStorytellerAgents,
  useStorytellerProjects,
} from "@/apis/storyteller.ts";
import { useAuth } from "@/components/auth/AuthContext.ts";
import { CustomEmptyState } from "@/components/common/CustomEmptyState.tsx";
import { CustomLoginRequiredState } from "@/components/common/CustomLoginRequiredState.tsx";
import { ConfirmNameDialog } from "@/components/common/ConfirmNameDialog.tsx";
import {
  formatStorytellerDate,
  storytellerProjectRatingColor,
  storytellerProjectRatingLabel,
} from "@/data/storyteller.ts";
import { useTitle } from "@/helpers/title.tsx";
import { StorytellerAgentUsagePanel } from "@/pages/storyteller/AgentUsagePanel.tsx";
import { StorytellerApiKeyPanel } from "@/pages/storyteller/ApiKeyManagement.tsx";
import { StorytellerProjectCard } from "@/pages/storyteller/StorytellerProjectCard.tsx";
import {
  StorytellerLoading,
  StorytellerShell,
} from "@/pages/storyteller/StorytellerShell.tsx";
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

function ProjectCards({ projects }: { projects: StorytellerProject[] }) {
  const deleteProject = useDeleteStorytellerProject();
  const [deleteTarget, setDeleteTarget] = useState<{
    id: string;
    name: string;
    apiBacked: boolean;
  } | null>(null);
  const rows = projects.map((project) => ({
    id: project.public_id,
    name: project.name,
    description: project.description,
    statusLabel:
      project.visibility === "public"
        ? "已公開"
        : project.visibility === "unlisted"
          ? "與親友分享"
          : "完全不公開",
    statusColor: project.visibility === "private" ? "default" : "primary",
    storiesCount: project.stories?.length ?? 0,
    rating: project.rating,
    tags: project.tags ?? [],
    wordCount:
      project.stories?.reduce((total, story) => total + story.word_count, 0) ??
      0,
    ratingCount: project.rating_count,
    averageRating: project.average_rating,
    updatedAt: project.updated_at,
    apiBacked: true,
  }));

  return (
    <>
      {deleteProject.isError && (
        <Alert severity="error" variant="outlined" sx={{ mb: 2 }}>
          刪除專案失敗，請確認登入狀態後再試一次。
        </Alert>
      )}
      {rows.length === 0 ? (
        <CustomEmptyState
          icon={<AutoStoriesIcon fontSize="large" />}
          title="目前還沒有故事專案"
          description="可以使用上方的「建立專案」開始建立第一個故事專案。"
        />
      ) : (
        <Grid container spacing={2}>
          {rows.map((project) => (
            <Grid key={project.id} size={{ xs: 12, md: 4 }}>
              <StorytellerProjectCard
                name={project.name}
                description={project.description}
                updatedAt={project.updatedAt}
                chips={
                  <>
                    <Chip
                      size="small"
                      label={project.statusLabel}
                      color={project.statusColor as "primary" | "default"}
                    />
                    <Chip
                      size="small"
                      color={storytellerProjectRatingColor(project.rating)}
                      label={storytellerProjectRatingLabel(project.rating)}
                    />
                    <Chip
                      size="small"
                      label={`${project.storiesCount} 篇故事`}
                    />
                    <Chip
                      size="small"
                      label={`${project.wordCount.toLocaleString()} 字`}
                    />
                    <Chip
                      size="small"
                      label={`${project.ratingCount} 人評分`}
                    />
                    <Chip
                      size="small"
                      label={`平均 ${project.averageRating.toFixed(1)}`}
                    />
                    {project.tags.map((tag) => (
                      <Chip key={tag} size="small" label={tag} />
                    ))}
                  </>
                }
                actions={
                  <>
                    <Button
                      component={RouterLink}
                      to={`/storyteller/my/project/${project.id}`}
                      size="small"
                      variant="outlined"
                    >
                      開啟專案
                    </Button>
                    <Button
                      component={RouterLink}
                      to={`/storyteller/my/project/${project.id}/edit`}
                      size="small"
                      variant="outlined"
                      startIcon={<EditIcon />}
                      disabled={!project.apiBacked}
                    >
                      編輯
                    </Button>
                    <Button
                      size="small"
                      color="error"
                      variant="outlined"
                      startIcon={<DeleteIcon />}
                      disabled={!project.apiBacked}
                      onClick={() =>
                        setDeleteTarget({
                          id: project.id,
                          name: project.name,
                          apiBacked: project.apiBacked,
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
            if (!deleteTarget.apiBacked) {
              setDeleteTarget(null);
              return;
            }
            deleteProject.mutate(deleteTarget.id, {
              onSuccess: () => setDeleteTarget(null),
            });
          }}
        />
      )}
    </>
  );
}

function AgentCards({ agents }: { agents: StorytellerAgent[] }) {
  const deleteAgent = useDeleteStorytellerAgent();
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
                  </Stack>
                  <Typography variant="caption" color="text.secondary">
                    更新於 {formatStorytellerDate(agent.updatedAt)}
                  </Typography>
                  <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                    <Button
                      component={RouterLink}
                      to={`/storyteller/my/agent/${agent.id}/edit`}
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
                      variant="outlined"
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

const tabPath: Record<"project" | "agent" | "apikey" | "usage", string> = {
  project: "project",
  agent: "agent",
  apikey: "api-keys",
  usage: "usage",
};

export default function StorytellerHome() {
  const location = useLocation();
  const navigate = useNavigate();
  const activeTab = location.pathname.endsWith("/agent")
    ? "agent"
    : location.pathname.endsWith("/api-keys")
      ? "apikey"
      : location.pathname.endsWith("/usage")
        ? "usage"
        : "project";
  const [tab, setTab] = useState(activeTab);
  const { session, loading, login, submitting } = useAuth();
  const { data: projects = [], isLoading: projectsLoading } =
    useStorytellerProjects();
  const { data: agents = [], isLoading: agentsLoading } =
    useStorytellerAgents();
  useTitle("Storyteller 我的工作台", {
    path: `/storyteller/my/${tabPath[activeTab]}`,
    robots: "noindex, nofollow",
  });

  useEffect(() => {
    setTab(activeTab);
  }, [activeTab]);

  function handleTabChange(value: "project" | "agent" | "apikey" | "usage") {
    setTab(value);
    navigate(`/storyteller/my/${tabPath[value]}`);
  }

  return (
    <StorytellerShell
      title="Storyteller"
      description="故事專案、AI Agent 與金鑰管理的工作台。"
      breadcrumbs={[
        { label: "Storyteller", to: "/storyteller" },
        { label: "我的工作台" },
      ]}
    >
      {loading ? (
        <Stack alignItems="center" sx={{ py: 8 }}>
          <Typography color="text.secondary">正在確認登入狀態...</Typography>
        </Stack>
      ) : !session ? (
        <CustomLoginRequiredState
          description="登入後即可查看我的工作台。"
          onLogin={() => void login()}
          submitting={submitting}
        />
      ) : (
        <Paper variant="outlined" sx={{ borderRadius: 1 }}>
          <Tabs value={tab} onChange={(_, value) => handleTabChange(value)}>
            <Tab value="project" label="故事專案" />
            <Tab value="agent" label="AI Agent" />
            <Tab value="apikey" label="金鑰管理" />
            <Tab value="usage" label="用量報表" />
          </Tabs>
          <Divider />
          <Box sx={{ p: { xs: 2, md: 3 } }}>
            <Stack spacing={2}>
              {tab !== "apikey" && tab !== "usage" && (
                <Stack
                  direction={{ xs: "column", sm: "row" }}
                  spacing={1.5}
                  justifyContent="space-between"
                  alignItems={{ xs: "stretch", sm: "center" }}
                >
                  <Typography variant="h6" fontWeight={800}>
                    {tab === "project" ? "最近的故事專案" : "可用的 AI Agent"}
                  </Typography>
                  {tab === "project" ? (
                    <Button
                      component={RouterLink}
                      to="/storyteller/my/project/new"
                      variant="contained"
                    >
                      建立專案
                    </Button>
                  ) : (
                    <Button
                      component={RouterLink}
                      to="/storyteller/my/agent/new"
                      variant="contained"
                    >
                      建立 AI Agent
                    </Button>
                  )}
                </Stack>
              )}
              {tab === "project" && projectsLoading ? (
                <StorytellerLoading label="正在載入故事專案..." />
              ) : tab === "project" ? (
                <ProjectCards projects={projects} />
              ) : tab === "agent" && agentsLoading ? (
                <StorytellerLoading label="正在載入 AI Agent..." />
              ) : tab === "agent" ? (
                <AgentCards agents={agents} />
              ) : tab === "apikey" ? (
                <StorytellerApiKeyPanel />
              ) : (
                <StorytellerAgentUsagePanel />
              )}
            </Stack>
          </Box>
        </Paper>
      )}
    </StorytellerShell>
  );
}
