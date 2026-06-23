import AutoStoriesIcon from "@mui/icons-material/AutoStories";
import FavoriteIcon from "@mui/icons-material/Favorite";
import {
  Alert,
  Button,
  CircularProgress,
  Grid,
  Paper,
  Stack,
  Typography,
} from "@mui/material";
import { Link as RouterLink } from "react-router-dom";
import { useFavoriteStorytellerProjects } from "@/apis/storyteller.ts";
import { formatStorytellerDate } from "@/data/storyteller.ts";
import { useTitle } from "@/helpers/title.tsx";
import { StorytellerShell } from "@/pages/storyteller/StorytellerShell.tsx";

export default function StorytellerFavorites() {
  const { data: projects = [], isLoading, isError } =
    useFavoriteStorytellerProjects();

  useTitle("Storyteller 我的收藏", {
    path: "/storyteller/favorites",
    robots: "noindex, nofollow",
  });

  return (
    <StorytellerShell
      title="我的收藏"
      description="整理已收藏的故事專案。"
      breadcrumbs={[
        { label: "Storyteller", to: "/storyteller" },
        { label: "我的收藏" },
      ]}
    >
      {isLoading ? (
        <Stack alignItems="center" sx={{ py: 8 }}>
          <CircularProgress />
        </Stack>
      ) : isError ? (
        <Alert severity="error" variant="outlined">
          讀取收藏失敗，請確認登入狀態後再試一次。
        </Alert>
      ) : projects.length === 0 ? (
        <Paper variant="outlined" sx={{ p: 3, borderRadius: 1 }}>
          <Stack spacing={2} alignItems="flex-start">
            <FavoriteIcon color="primary" />
            <Typography variant="h6" fontWeight={800}>
              尚未收藏故事
            </Typography>
            <Alert severity="info" variant="outlined">
              在故事閱讀頁按下收藏後，會在此列出故事專案。
            </Alert>
          </Stack>
        </Paper>
      ) : (
        <Grid container spacing={2}>
          {projects.map((project) => (
            <Grid key={project.public_id} size={{ xs: 12, md: 6, lg: 4 }}>
              <Paper
                variant="outlined"
                sx={{
                  p: 2,
                  borderRadius: 1,
                  height: 1,
                  boxSizing: "border-box",
                }}
              >
                <Stack spacing={1.5} sx={{ height: 1, minWidth: 0 }}>
                  <Stack direction="row" spacing={1} alignItems="center">
                    <AutoStoriesIcon color="primary" />
                    <Typography
                      variant="h6"
                      fontWeight={800}
                      sx={{ minWidth: 0, overflowWrap: "anywhere" }}
                    >
                      {project.name}
                    </Typography>
                  </Stack>
                  <Typography
                    color="text.secondary"
                    sx={{ flex: 1, minWidth: 0, overflowWrap: "anywhere" }}
                  >
                    {project.description}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    更新於 {formatStorytellerDate(project.updated_at)}
                  </Typography>
                  <Button
                    component={RouterLink}
                    to={`/storyteller/story/${project.public_id}-${project.slug}`}
                    variant="contained"
                  >
                    開始閱讀
                  </Button>
                </Stack>
              </Paper>
            </Grid>
          ))}
        </Grid>
      )}
    </StorytellerShell>
  );
}
