import LockOpenIcon from "@mui/icons-material/LockOpen";
import {
  Button,
  Chip,
  Grid,
} from "@mui/material";
import { Link as RouterLink } from "react-router-dom";
import { usePublicStorytellerProjects } from "@/apis/storyteller.ts";
import {
  getPublicProjects,
  publicProjectPath,
} from "@/data/storyteller.ts";
import { useTitle } from "@/helpers/title.tsx";
import { StorytellerProjectCard } from "@/pages/storyteller/StorytellerProjectCard.tsx";
import { StorytellerShell } from "@/pages/storyteller/StorytellerShell.tsx";

export default function StorytellerPublicHome() {
  const { data: apiProjects = [] } = usePublicStorytellerProjects();
  const publicProjects =
    apiProjects.length > 0
      ? apiProjects.map((project) => ({
          id: project.public_id,
          name: project.name,
          description: project.description,
          storiesCount: project.stories?.length ?? 0,
          updatedAt: project.updated_at,
          path: `/storyteller/story/${project.public_id}-${project.slug}`,
        }))
      : getPublicProjects().map((project) => ({
          id: project.id,
          name: project.name,
          description: project.description,
          storiesCount: project.storiesCount,
          updatedAt: project.updatedAt,
          path: publicProjectPath(project),
        }));

  useTitle("Storyteller 公開故事", {
    path: "/storyteller",
    robots: "index, follow",
  });

  return (
    <StorytellerShell
      title="Storyteller"
      description="公開故事專案與章節索引。"
      breadcrumbs={[{ label: "Storyteller" }]}
      action={
        <Button component={RouterLink} to="/storyteller/mine" variant="outlined">
          我的工作台
        </Button>
      }
    >
      <Grid container spacing={2}>
        {publicProjects.map((project) => (
          <Grid key={project.id} size={{ xs: 12, md: 6, lg: 4 }}>
            <StorytellerProjectCard
              name={project.name}
              description={project.description}
              updatedAt={project.updatedAt}
              chips={
                <>
                  <Chip size="small" icon={<LockOpenIcon />} label="公開閱讀" />
                  <Chip size="small" label={`${project.storiesCount} 篇故事`} />
                </>
              }
              actions={
                <Button
                  component={RouterLink}
                  to={project.path}
                  variant="contained"
                >
                  開始閱讀
                </Button>
              }
            />
          </Grid>
        ))}
      </Grid>
    </StorytellerShell>
  );
}
