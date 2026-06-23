import AddIcon from "@mui/icons-material/Add";
import DeleteIcon from "@mui/icons-material/Delete";
import EditIcon from "@mui/icons-material/Edit";
import SmartToyIcon from "@mui/icons-material/SmartToy";
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
import { useState } from "react";
import { Link as RouterLink } from "react-router-dom";
import {
  useDeleteStorytellerProject,
  useStorytellerAgents,
  useStorytellerProjects,
} from "@/apis/storyteller.ts";
import { ConfirmNameDialog } from "@/components/common/ConfirmNameDialog.tsx";
import {
  formatStorytellerDate,
  projectStatusLabel,
  storytellerAgents,
  storytellerProjects,
} from "@/data/storyteller.ts";
import { useTitle } from "@/helpers/title.tsx";
import { StorytellerProjectCard } from "@/pages/storyteller/StorytellerProjectCard.tsx";
import {
  StorytellerPrimaryActions,
  StorytellerShell,
} from "@/pages/storyteller/StorytellerShell.tsx";
import type {
  StorytellerAgent,
  StorytellerProject,
} from "@/types/storyteller.ts";

function ProjectCards({ projects }: { projects: StorytellerProject[] }) {
  const deleteProject = useDeleteStorytellerProject();
  const [deleteTarget, setDeleteTarget] = useState<{
    id: string;
    name: string;
    apiBacked: boolean;
  } | null>(null);
  const rows =
    projects.length > 0
      ? projects.map((project) => ({
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
          wordCount:
            project.stories?.reduce(
              (total, story) => total + story.word_count,
              0,
            ) ?? 0,
          ratingCount: project.rating_count,
          averageRating: project.average_rating,
          updatedAt: project.updated_at,
          apiBacked: true,
        }))
      : storytellerProjects.map((project) => ({
          id: project.id,
          name: project.name,
          description: project.description,
          statusLabel: projectStatusLabel(project.status),
          statusColor: project.status === "drafting" ? "primary" : "default",
          storiesCount: project.storiesCount,
          wordCount: 0,
          ratingCount: 0,
          averageRating: 0,
          updatedAt: project.updatedAt,
          apiBacked: false,
        }));

  return (
    <>
      {deleteProject.isError && (
        <Alert severity="error" variant="outlined" sx={{ mb: 2 }}>
          刪除專案失敗，請確認登入狀態後再試一次。
        </Alert>
      )}
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
                  <Chip size="small" label={`${project.storiesCount} 篇故事`} />
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
                </>
              }
              actions={
                <>
                  <Button
                    component={RouterLink}
                    to={`/storyteller/project/${project.id}`}
                    size="small"
                    variant="outlined"
                  >
                    開啟專案
                  </Button>
                  <Button
                    component={RouterLink}
                    to={`/storyteller/project/${project.id}/edit`}
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
  const rows =
    agents.length > 0
      ? agents.map((agent) => ({
          id: agent.id,
          name: agent.name,
          purpose: agent.default_prompt,
          provider: agent.provider,
          model: agent.model_name,
          enabled: !agent.is_deleted,
          updatedAt: agent.updated_at,
        }))
      : storytellerAgents.map((agent) => ({
          id: agent.id,
          name: agent.name,
          purpose: agent.purpose,
          provider: agent.provider,
          model: agent.model,
          enabled: agent.enabled,
          updatedAt: agent.updatedAt,
        }));

  return (
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
              <Stack direction="row" spacing={1} alignItems="center" sx={{ minWidth: 0 }}>
                <SmartToyIcon color={agent.enabled ? "primary" : "disabled"} />
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
                {agent.purpose}
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
                <Chip
                  size="small"
                  label={agent.enabled ? "啟用" : "停用"}
                  color={agent.enabled ? "success" : "default"}
                />
              </Stack>
              <Typography variant="caption" color="text.secondary">
                更新於 {formatStorytellerDate(agent.updatedAt)}
              </Typography>
            </Stack>
          </Paper>
        </Grid>
      ))}
    </Grid>
  );
}

export default function StorytellerHome() {
  const [tab, setTab] = useState("projects");
  const { data: projects = [] } = useStorytellerProjects();
  const { data: agents = [] } = useStorytellerAgents();
  useTitle("Storyteller 我的工作台", {
    path: "/storyteller/mine",
    robots: "noindex, nofollow",
  });

  return (
    <StorytellerShell
      title="Storyteller"
      description="故事專案、章節草稿與 AI Agent 的工作台。此階段先提供前端畫面與操作動線。"
      breadcrumbs={[
        { label: "Storyteller", to: "/storyteller" },
        { label: "我的工作台" },
      ]}
      action={<StorytellerPrimaryActions />}
    >
      <Paper variant="outlined" sx={{ borderRadius: 1 }}>
        <Tabs value={tab} onChange={(_, value) => setTab(value)}>
          <Tab value="projects" label="故事專案" />
          <Tab value="agents" label="AI Agent" />
        </Tabs>
        <Divider />
        <Box sx={{ p: { xs: 2, md: 3 } }}>
          <Stack spacing={2}>
            <Stack
              direction={{ xs: "column", sm: "row" }}
              alignItems={{ xs: "stretch", sm: "center" }}
              justifyContent="space-between"
              spacing={1}
            >
              <Typography variant="h6" fontWeight={800}>
                {tab === "projects" ? "最近的故事專案" : "可用的 AI Agent"}
              </Typography>
              <Button
                component={RouterLink}
                to={
                  tab === "projects"
                    ? "/storyteller/project/new"
                    : "/storyteller/agent/new"
                }
                startIcon={<AddIcon />}
                variant="contained"
              >
                {tab === "projects" ? "新增專案" : "新增 Agent"}
              </Button>
            </Stack>
            {tab === "projects" ? (
              <ProjectCards projects={projects} />
            ) : (
              <AgentCards agents={agents} />
            )}
          </Stack>
        </Box>
      </Paper>
    </StorytellerShell>
  );
}
