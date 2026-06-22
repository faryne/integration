import ArticleIcon from "@mui/icons-material/Article";
import SmartToyIcon from "@mui/icons-material/SmartToy";
import {
  Alert,
  Button,
  Chip,
  Grid,
  Paper,
  Stack,
  Typography,
} from "@mui/material";
import { useParams } from "react-router-dom";
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
  const project = storytellerProjects.find((item) => item.id === id);
  const stories = project ? getProjectStories(project.id) : [];

  useTitle(project ? `${project.name} - Storyteller` : "Storyteller 專案", {
    path: id ? `/storyteller/project/${id}` : "/storyteller/project",
    robots: "noindex, nofollow",
  });

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
            <Chip label={projectStatusLabel(project.status)} color="primary" />
            <Chip label={`${project.storiesCount} 篇故事`} />
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
                {storytellerAgents.slice(0, 2).map((agent) => (
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
                  關聯 Agent 與故事資料目前為前端假資料。
                </Alert>
              </Stack>
            </Paper>
          </Grid>
        </Grid>
      </Stack>
    </StorytellerShell>
  );
}
