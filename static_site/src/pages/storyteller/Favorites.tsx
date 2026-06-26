import FavoriteIcon from "@mui/icons-material/Favorite";
import PersonIcon from "@mui/icons-material/Person";
import {
  Alert,
  Button,
  Chip,
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
  useFavoriteStorytellerAuthors,
  useFavoriteStorytellerProjects,
} from "@/apis/storyteller.ts";
import { useAuth } from "@/components/auth/AuthContext.ts";
import { useTitle } from "@/helpers/title.tsx";
import { StorytellerProjectCard } from "@/pages/storyteller/StorytellerProjectCard.tsx";
import {
  StorytellerLoading,
  StorytellerShell,
} from "@/pages/storyteller/StorytellerShell.tsx";

export default function StorytellerFavorites() {
  const { session, loading, login, submitting } = useAuth();
  const [tab, setTab] = useState<"stories" | "authors">("stories");
  const {
    data: projects = [],
    isLoading: projectsLoading,
    isError: projectsError,
  } = useFavoriteStorytellerProjects();
  const {
    data: authors = [],
    isLoading: authorsLoading,
    isError: authorsError,
  } = useFavoriteStorytellerAuthors();
  const isLoading = tab === "stories" ? projectsLoading : authorsLoading;
  const isError = tab === "stories" ? projectsError : authorsError;

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
      {loading ? (
        <StorytellerLoading label="正在確認登入狀態..." />
      ) : !session ? (
        <Paper variant="outlined" sx={{ p: 3, borderRadius: 1 }}>
          <Stack spacing={2} alignItems="flex-start">
            <Alert severity="info" variant="outlined">
              登入後即可查看我的收藏。
            </Alert>
            <Button
              variant="contained"
              onClick={() => void login()}
              disabled={submitting}
            >
              {submitting ? "登入中..." : "使用 Google 登入"}
            </Button>
          </Stack>
        </Paper>
      ) : (
        <Stack spacing={2}>
          <Tabs
            value={tab}
            onChange={(_, value: "stories" | "authors") => setTab(value)}
            aria-label="收藏分類"
          >
            <Tab value="stories" label="故事" />
            <Tab value="authors" label="作者" />
          </Tabs>

          {isLoading ? (
            <StorytellerLoading
              label={
                tab === "stories"
                  ? "正在載入收藏故事..."
                  : "正在載入收藏作者..."
              }
            />
          ) : isError ? (
            <Alert severity="error" variant="outlined">
              讀取收藏失敗，請確認登入狀態後再試一次。
            </Alert>
          ) : tab === "stories" ? (
            projects.length === 0 ? (
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
                {projects.map((project) => {
                  const storyCount = project.stories?.length ?? 0;
                  const wordCount =
                    project.stories?.reduce(
                      (total, story) => total + story.word_count,
                      0,
                    ) ?? 0;
                  return (
                    <Grid
                      key={project.public_id}
                      size={{ xs: 12, md: 6, lg: 4 }}
                    >
                      <StorytellerProjectCard
                        name={project.name}
                        description={project.description}
                        updatedAt={project.updated_at}
                        authorName={project.author?.pen_name}
                        chips={
                          <>
                            <Chip size="small" label={`${storyCount} 篇故事`} />
                            <Chip
                              size="small"
                              label={`${wordCount.toLocaleString()} 字`}
                            />
                            <Chip
                              size="small"
                              label={`${project.rating_count} 人評分`}
                            />
                            <Chip
                              size="small"
                              label={`平均 ${project.average_rating.toFixed(1)}`}
                            />
                          </>
                        }
                        actions={
                          <Button
                            component={RouterLink}
                            to={`/storyteller/story/${project.public_id}-${project.slug}`}
                            variant="contained"
                          >
                            開始閱讀
                          </Button>
                        }
                      />
                    </Grid>
                  );
                })}
              </Grid>
            )
          ) : authors.length === 0 ? (
            <Paper variant="outlined" sx={{ p: 3, borderRadius: 1 }}>
              <Stack spacing={2} alignItems="flex-start">
                <PersonIcon color="primary" />
                <Typography variant="h6" fontWeight={800}>
                  尚未收藏作者
                </Typography>
                <Alert severity="info" variant="outlined">
                  在故事閱讀頁按下收藏作者後，會在此列出作者。
                </Alert>
              </Stack>
            </Paper>
          ) : (
            <Grid container spacing={2}>
              {authors.map((author) => (
                <Grid key={author.user_id} size={{ xs: 12, md: 6, lg: 4 }}>
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
                        <PersonIcon color="primary" />
                        <Typography
                          variant="h6"
                          fontWeight={800}
                          sx={{ minWidth: 0, overflowWrap: "anywhere" }}
                        >
                          {author.pen_name || "未命名作者"}
                        </Typography>
                      </Stack>
                      {author.bio && (
                        <Typography
                          color="text.secondary"
                          sx={{
                            flex: 1,
                            minWidth: 0,
                            overflowWrap: "anywhere",
                          }}
                        >
                          {author.bio}
                        </Typography>
                      )}
                      <Stack
                        direction="row"
                        spacing={1}
                        flexWrap="wrap"
                        useFlexGap
                      >
                        <Chip
                          size="small"
                          label={`${author.project_count} 個專案`}
                        />
                        <Chip
                          size="small"
                          label={`${author.story_count} 篇故事`}
                        />
                        <Chip
                          size="small"
                          label={`${author.word_count.toLocaleString()} 字`}
                        />
                        <Chip
                          size="small"
                          label={`${author.rating_count} 人評分`}
                        />
                        <Chip
                          size="small"
                          label={`平均 ${author.average_rating.toFixed(1)}`}
                        />
                      </Stack>
                      {author.pen_name && (
                        <Button
                          component={RouterLink}
                          to={`/storyteller/user/${encodeURIComponent(author.pen_name)}`}
                          variant="contained"
                        >
                          查看作者
                        </Button>
                      )}
                    </Stack>
                  </Paper>
                </Grid>
              ))}
            </Grid>
          )}
        </Stack>
      )}
    </StorytellerShell>
  );
}
