import LockOpenIcon from "@mui/icons-material/LockOpen";
import {
  Box,
  Button,
  Chip,
  Grid,
  Pagination,
  Stack,
  Typography,
} from "@mui/material";
import {
  Link as RouterLink,
  useParams,
  useSearchParams,
} from "react-router-dom";
import { usePublicUserStorytellerProjects } from "@/apis/storyteller.ts";
import { useTitle } from "@/helpers/title.tsx";
import { StorytellerProjectCard } from "@/pages/storyteller/StorytellerProjectCard.tsx";
import {
  StorytellerLoading,
  StorytellerShell,
} from "@/pages/storyteller/StorytellerShell.tsx";

export default function StorytellerUserProjects() {
  const { username } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const page = parseInt(searchParams.get("page") || "1", 10);
  const pageSize = 12;

  const { data, isLoading } = usePublicUserStorytellerProjects(
    username,
    page,
    pageSize,
  );

  useTitle(`${username} 的作品 - Storyteller`, {
    path: `/storyteller/user/${username}`,
    robots: "index, follow",
  });

  if (isLoading) {
    return (
      <StorytellerShell
        title={`${username} 的作品`}
        description={""}
        breadcrumbs={[
          { label: "Storyteller", to: "/storyteller" },
          { label: username || "作者" },
        ]}
      >
        <StorytellerLoading label="正在載入作者作品..." />
      </StorytellerShell>
    );
  }

  const items = (data?.items || []).map((project) => ({
    id: project.public_id,
    name: project.name,
    description: project.description,
    storiesCount: project.stories?.length ?? 0,
    wordCount:
      project.stories?.reduce((total, story) => total + story.word_count, 0) ??
      0,
    updatedAt: project.updated_at,
    path: `/storyteller/story/${project.public_id}-${project.slug}`,
  }));

  const totalPages = Math.ceil((data?.total || 0) / pageSize);

  return (
    <StorytellerShell
      title={`${username} 的作品`}
      description={`由 ${username} 創作的公開故事。`}
      breadcrumbs={[
        { label: "Storyteller", to: "/storyteller" },
        { label: username || "作者" },
      ]}
      action={
        <Button component={RouterLink} to="/storyteller" variant="outlined">
          回首頁
        </Button>
      }
    >
      {items.length > 0 ? (
        <Stack spacing={3}>
          <Grid container spacing={2}>
            {items.map((project) => (
              <Grid key={project.id} size={{ xs: 12, md: 6, lg: 4 }}>
                <StorytellerProjectCard
                  name={project.name}
                  description={project.description}
                  updatedAt={project.updatedAt}
                  chips={
                    <>
                      <Chip
                        size="small"
                        icon={<LockOpenIcon />}
                        label="公開閱讀"
                      />
                      <Chip
                        size="small"
                        label={`${project.storiesCount} 篇故事`}
                      />
                      <Chip
                        size="small"
                        label={`${project.wordCount.toLocaleString()} 字`}
                      />
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
          {totalPages > 1 && (
            <Box sx={{ display: "flex", justifyContent: "center", mt: 4 }}>
              <Pagination
                count={totalPages}
                page={page}
                onChange={(_, value) => {
                  setSearchParams({ page: value.toString() });
                }}
                color="primary"
              />
            </Box>
          )}
        </Stack>
      ) : (
        <Stack alignItems="center" sx={{ py: 8 }}>
          <Typography color="text.secondary">目前沒有公開的作品。</Typography>
        </Stack>
      )}
    </StorytellerShell>
  );
}
