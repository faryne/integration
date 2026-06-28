import LockOpenIcon from "@mui/icons-material/LockOpen";
import { Button, Chip, Grid } from "@mui/material";
import { Link as RouterLink } from "react-router-dom";
import { usePublicStorytellerProjects } from "@/apis/storyteller.ts";
import { CustomEmptyState } from "@/components/common/CustomEmptyState.tsx";
import { useTitle } from "@/helpers/title.tsx";
import {
  storytellerProjectRatingColor,
  storytellerProjectRatingLabel,
} from "@/data/storyteller.ts";
import { StorytellerProjectCard } from "@/pages/storyteller/StorytellerProjectCard.tsx";
import {
  StorytellerLoading,
  StorytellerShell,
} from "@/pages/storyteller/StorytellerShell.tsx";

export default function StorytellerPublicHome() {
  const { data: apiProjects = [], isLoading } = usePublicStorytellerProjects();
  const publicProjects = apiProjects.map((project) => ({
    id: project.public_id,
    name: project.name,
    description: project.description,
    storiesCount: project.stories?.length ?? 0,
    rating: project.rating,
    tags: project.tags ?? [],
    authorName: project.author?.pen_name,
    wordCount:
      project.stories?.reduce((total, story) => total + story.word_count, 0) ??
      0,
    updatedAt: project.updated_at,
    path: `/storyteller/story/${project.public_id}-${project.slug}`,
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
        <Button component={RouterLink} to="/storyteller/my" variant="outlined">
          我的工作台
        </Button>
      }
    >
      {isLoading ? (
        <StorytellerLoading label="正在載入公開故事..." />
      ) : publicProjects.length === 0 ? (
        <CustomEmptyState
          icon={<LockOpenIcon fontSize="large" />}
          title="目前還沒有公開故事專案"
          description="公開的 Storyteller 專案會顯示在這裡。"
        />
      ) : (
        <Grid container spacing={2}>
          {publicProjects.map((project) => (
            <Grid key={project.id} size={{ xs: 12, md: 6, lg: 4 }}>
              <StorytellerProjectCard
                name={project.name}
                description={project.description}
                updatedAt={project.updatedAt}
                authorName={project.authorName}
                chips={
                  <>
                    <Chip
                      size="small"
                      icon={<LockOpenIcon />}
                      label="公開閱讀"
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
                    {project.tags.map((tag) => (
                      <Chip key={tag} size="small" label={tag} />
                    ))}
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
      )}
    </StorytellerShell>
  );
}
