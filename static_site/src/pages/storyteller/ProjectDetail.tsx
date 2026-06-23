import ArticleIcon from "@mui/icons-material/Article";
import SmartToyIcon from "@mui/icons-material/SmartToy";
import {
  Alert,
  Button,
  Chip,
  CircularProgress,
  Grid,
  Paper,
  Stack,
  Typography,
} from "@mui/material";
import { useParams } from "react-router-dom";
import {
  useStorytellerAgents,
  useStorytellerProjects,
  useStorytellerStories,
} from "@/apis/storyteller.ts";
import {
  formatStorytellerDate,
  getProjectStories,
  projectStatusLabel,
  storytellerAgents,
  storytellerProjects,
} from "@/data/storyteller.ts";
import { useTitle } from "@/helpers/title.tsx";
import { ErrorPage } from "@/pages/ErrorPage.tsx";
import { StorytellerShell } from "@/pages/storyteller/StorytellerShell.tsx";

export default function StorytellerProjectDetail() {
  const { id } = useParams();
  const { data: apiProjects = [], isPending: apiProjectsPending } =
    useStorytellerProjects();
  const apiProject = apiProjects.find((item) => item.public_id === id);
  const mockProject = storytellerProjects.find((item) => item.id === id);
  const project = apiProject
    ? {
        id: apiProject.public_id,
        name: apiProject.name,
        slug: apiProject.slug,
        description: apiProject.description,
        statusLabel:
          apiProject.visibility === "public"
            ? "已公開"
            : apiProject.visibility === "unlisted"
              ? "與親友分享"
              : "完全不公開",
        storiesCount: apiProject.stories?.length ?? 0,
        updatedAt: apiProject.updated_at,
      }
    : mockProject
      ? {
          id: mockProject.id,
          name: mockProject.name,
          slug: mockProject.slug,
          description: mockProject.description,
          statusLabel: projectStatusLabel(mockProject.status),
          storiesCount: mockProject.storiesCount,
          updatedAt: mockProject.updatedAt,
        }
      : undefined;
  const { data: apiStories = [] } = useStorytellerStories(apiProject?.public_id);
  const stories =
    apiStories.length > 0
      ? apiStories.map((story) => ({
          id: story.public_id,
          title: story.title,
          words: story.latest_content.length,
          updatedAt: story.updated_at,
        }))
      : mockProject
        ? getProjectStories(mockProject.id).map((story) => ({
            id: story.id,
            title: story.title,
            words: story.words,
            updatedAt: story.updatedAt,
          }))
        : [];
  const { data: apiAgents = [] } = useStorytellerAgents();
  const agents =
    apiAgents.length > 0
      ? apiAgents.slice(0, 2).map((agent) => ({
          id: agent.id,
          name: agent.name,
          purpose: agent.default_prompt,
        }))
      : storytellerAgents.slice(0, 2).map((agent) => ({
          id: agent.id,
          name: agent.name,
          purpose: agent.purpose,
        }));

  useTitle(project ? `${project.name} - Storyteller` : "Storyteller 專案", {
    path: id ? `/storyteller/project/${id}` : "/storyteller/project",
    robots: "noindex, nofollow",
  });

  if (!project && apiProjectsPending) {
    return (
      <Stack alignItems="center" sx={{ py: 8 }}>
        <CircularProgress />
      </Stack>
    );
  }

  if (!project) {
    return <ErrorPage code={404} />;
  }

  return (
    <StorytellerShell
      title={project.name}
      description={project.description}
      breadcrumbs={[
        { label: "Storyteller", to: "/storyteller" },
        { label: "專案列表", to: "/storyteller/project" },
        { label: project.name },
      ]}
      action={
        <Button
          href={`/storyteller/project/${project.id}/story/new`}
          variant="contained"
        >
          建立故事
        </Button>
      }
    >
      <Stack spacing={3}>
        <Paper variant="outlined" sx={{ p: 2, borderRadius: 1 }}>
          <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
            <Chip label={`特殊網址：${project.slug}`} />
            <Chip label={project.statusLabel} color="primary" />
            <Chip label={`${stories.length || project.storiesCount} 篇故事`} />
            <Chip label={`更新於 ${formatStorytellerDate(project.updatedAt)}`} />
          </Stack>
        </Paper>

        <Grid container spacing={2}>
          <Grid size={{ xs: 12, md: 7 }}>
            <Paper variant="outlined" sx={{ p: 2, borderRadius: 1 }}>
              <Stack spacing={2}>
                <Typography variant="h6" fontWeight={800}>
                  故事列表
                </Typography>
                {stories.map((story) => (
                  <Paper key={story.id} variant="outlined" sx={{ p: 2, borderRadius: 1 }}>
                    <Stack direction="row" spacing={1.5} alignItems="center">
                      <ArticleIcon color="primary" />
                      <Stack sx={{ flex: 1 }}>
                        <Typography fontWeight={800}>{story.title}</Typography>
                        <Typography variant="body2" color="text.secondary">
                          {story.words.toLocaleString()} 字 · {formatStorytellerDate(story.updatedAt)}
                        </Typography>
                      </Stack>
                      <Button
                        href={`/storyteller/project/${project.id}/story/${story.id}`}
                        variant="outlined"
                        size="small"
                      >
                        編輯
                      </Button>
                    </Stack>
                  </Paper>
                ))}
              </Stack>
            </Paper>
          </Grid>
          <Grid size={{ xs: 12, md: 5 }}>
            <Paper variant="outlined" sx={{ p: 2, borderRadius: 1 }}>
              <Stack spacing={2}>
                <Typography variant="h6" fontWeight={800}>
                  專案 AI Agent
                </Typography>
                {agents.map((agent) => (
                  <Stack key={agent.id} direction="row" spacing={1.5} alignItems="flex-start">
                    <SmartToyIcon color="primary" />
                    <Stack>
                      <Typography fontWeight={800}>{agent.name}</Typography>
                      <Typography variant="body2" color="text.secondary">
                        {agent.purpose}
                      </Typography>
                    </Stack>
                  </Stack>
                ))}
                <Alert severity="info" variant="outlined">
                  關聯 Agent 功能尚未實作，此處先顯示目前可用 Agent。
                </Alert>
              </Stack>
            </Paper>
          </Grid>
        </Grid>
      </Stack>
    </StorytellerShell>
  );
}
