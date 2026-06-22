import AddIcon from "@mui/icons-material/Add";
import AutoStoriesIcon from "@mui/icons-material/AutoStories";
import SmartToyIcon from "@mui/icons-material/SmartToy";
import {
  Box,
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
  formatStorytellerDate,
  projectStatusLabel,
  storytellerAgents,
  storytellerProjects,
} from "@/data/storyteller.ts";
import { useTitle } from "@/helpers/title.tsx";
import {
  StorytellerPrimaryActions,
  StorytellerShell,
} from "@/pages/storyteller/StorytellerShell.tsx";

function ProjectCards() {
  return (
    <Grid container spacing={2}>
      {storytellerProjects.map((project) => (
        <Grid key={project.id} size={{ xs: 12, md: 4 }}>
          <Paper variant="outlined" sx={{ p: 2, borderRadius: 1, height: 1 }}>
            <Stack spacing={1.5} sx={{ height: 1 }}>
              <Stack direction="row" spacing={1} alignItems="center">
                <AutoStoriesIcon color="primary" />
                <Typography variant="h6" fontWeight={800}>
                  {project.name}
                </Typography>
              </Stack>
              <Typography color="text.secondary" sx={{ flex: 1 }}>
                {project.description}
              </Typography>
              <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                <Chip
                  size="small"
                  label={projectStatusLabel(project.status)}
                  color={project.status === "drafting" ? "primary" : "default"}
                />
                <Chip size="small" label={`${project.storiesCount} 篇故事`} />
              </Stack>
              <Typography variant="caption" color="text.secondary">
                更新於 {formatStorytellerDate(project.updatedAt)}
              </Typography>
              <Button
                component={RouterLink}
                to={`/storyteller/project/${project.id}`}
                size="small"
                variant="outlined"
              >
                開啟專案
              </Button>
            </Stack>
          </Paper>
        </Grid>
      ))}
    </Grid>
  );
}

function AgentCards() {
  return (
    <Grid container spacing={2}>
      {storytellerAgents.map((agent) => (
        <Grid key={agent.id} size={{ xs: 12, md: 4 }}>
          <Paper variant="outlined" sx={{ p: 2, borderRadius: 1, height: 1 }}>
            <Stack spacing={1.5} sx={{ height: 1 }}>
              <Stack direction="row" spacing={1} alignItems="center">
                <SmartToyIcon color={agent.enabled ? "primary" : "disabled"} />
                <Typography variant="h6" fontWeight={800}>
                  {agent.name}
                </Typography>
              </Stack>
              <Typography color="text.secondary" sx={{ flex: 1 }}>
                {agent.purpose}
              </Typography>
              <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
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
  useTitle("Storyteller", {
    path: "/storyteller",
    robots: "noindex, nofollow",
  });

  return (
    <StorytellerShell
      title="Storyteller"
      description="故事專案、章節草稿與 AI Agent 的工作台。此階段先提供前端畫面與操作動線。"
      breadcrumbs={[{ label: "Storyteller" }]}
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
            {tab === "projects" ? <ProjectCards /> : <AgentCards />}
          </Stack>
        </Box>
      </Paper>
    </StorytellerShell>
  );
}
