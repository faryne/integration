import FavoriteIcon from "@mui/icons-material/Favorite";
import PersonIcon from "@mui/icons-material/Person";
import VisibilityIcon from "@mui/icons-material/Visibility";
import VisibilityOffIcon from "@mui/icons-material/VisibilityOff";
import {
  Alert,
  Avatar,
  Button,
  Chip,
  Grid,
  IconButton,
  Paper,
  Stack,
  Tab,
  Tabs,
  Tooltip,
  Typography,
} from "@mui/material";
import { useState } from "react";
import { Link as RouterLink } from "react-router-dom";
import {
  useFavoriteStorytellerAuthors,
  useFavoriteStorytellerProjects,
  useSaveFavoriteAuthorVisibility,
  useSaveFavoriteProjectVisibility,
} from "@/apis/storyteller.ts";
import { useAuth } from "@/components/auth/AuthContext.ts";
import { CustomEmptyState } from "@/components/common/CustomEmptyState.tsx";
import { CustomLoginRequiredState } from "@/components/common/CustomLoginRequiredState.tsx";
import {
  STORYTELLER_APP_NAME,
  storytellerProjectRatingColor,
  storytellerProjectRatingLabel,
} from "@/data/storyteller.ts";
import { steamloomPath } from "@/helpers/steamloom.ts";
import { useTitle } from "@/helpers/title.tsx";
import { StorytellerProjectCard } from "@/pages/storyteller/StorytellerProjectCard.tsx";
import {
  StorytellerLoading,
  StorytellerShell,
} from "@/pages/storyteller/StorytellerShell.tsx";
import { AuthorBio } from "@/pages/storyteller/UserProjects.tsx";
import type {
  StorytellerFavoriteAuthor,
  StorytellerProject,
} from "@/types/storyteller.ts";

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

  useTitle(`${STORYTELLER_APP_NAME} 我的收藏`, {
    path: steamloomPath("favorites"),
    robots: "noindex, nofollow",
  });

  return (
    <StorytellerShell
      title="我的收藏"
      breadcrumbs={[
        { label: STORYTELLER_APP_NAME, to: steamloomPath() },
        { label: "我的收藏" },
      ]}
    >
      {loading ? (
        <StorytellerLoading label="正在確認登入狀態..." />
      ) : !session ? (
        <CustomLoginRequiredState
          description="登入後即可查看我的收藏。"
          onLogin={() => void login()}
          submitting={submitting}
        />
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
              <CustomEmptyState
                icon={<FavoriteIcon fontSize="large" />}
                title="尚未收藏故事"
                description="在故事閱讀頁按下收藏後，會在此列出創作專案。"
              />
            ) : (
              <Grid container spacing={2}>
                {projects.map((project) => (
                  <Grid key={project.public_id} size={{ xs: 12, md: 6, lg: 4 }}>
                    <FavoriteProjectCard project={project} />
                  </Grid>
                ))}
              </Grid>
            )
          ) : authors.length === 0 ? (
            <CustomEmptyState
              icon={<PersonIcon fontSize="large" />}
              title="尚未收藏作者"
              description="在故事閱讀頁按下收藏作者後，會在此列出作者。"
            />
          ) : (
            <Grid container spacing={2}>
              {authors.map((author) => (
                <Grid key={author.user_id} size={{ xs: 12, md: 6, lg: 4 }}>
                  <FavoriteAuthorCard author={author} />
                </Grid>
              ))}
            </Grid>
          )}
        </Stack>
      )}
    </StorytellerShell>
  );
}

function FavoriteProjectCard({ project }: { project: StorytellerProject }) {
  const saveVisibility = useSaveFavoriteProjectVisibility(project.public_id);
  const hidden = project.favorite_hidden ?? false;
  const storyCount = project.stories?.length ?? 0;
  const wordCount =
    project.stories?.reduce((total, story) => total + story.word_count, 0) ?? 0;

  return (
    <StorytellerProjectCard
      name={project.name}
      description={project.description}
      updatedAt={project.updated_at}
      authorName={project.author?.pen_name}
      tags={project.tags}
      headerAction={
        <Tooltip title={hidden ? "設為公開" : "設為隱藏"}>
          <span>
            <IconButton
              size="small"
              aria-label={hidden ? "設為公開" : "設為隱藏"}
              disabled={saveVisibility.isPending}
              onClick={() => saveVisibility.mutate(!hidden)}
            >
              {hidden ? <VisibilityOffIcon /> : <VisibilityIcon />}
            </IconButton>
          </span>
        </Tooltip>
      }
      chips={
        <>
          <Chip
            size="small"
            color={storytellerProjectRatingColor(project.rating)}
            label={storytellerProjectRatingLabel(project.rating)}
          />
          <Chip size="small" label={`${storyCount} 篇故事`} />
          <Chip size="small" label={`${wordCount.toLocaleString()} 字`} />
          <Chip size="small" label={`${project.rating_count} 人評分`} />
          <Chip
            size="small"
            label={`平均 ${project.average_rating.toFixed(1)}`}
          />
          {hidden && <Chip size="small" color="warning" label="對外隱藏中" />}
        </>
      }
      actions={
        <Button
          component={RouterLink}
          to={steamloomPath(`story/${project.public_id}-${project.slug}`)}
          variant="contained"
        >
          開始閱讀
        </Button>
      }
    />
  );
}

function FavoriteAuthorCard({ author }: { author: StorytellerFavoriteAuthor }) {
  const saveVisibility = useSaveFavoriteAuthorVisibility(author.user_id);
  const hidden = author.hidden ?? false;

  return (
    <Paper
      variant="outlined"
      sx={{ p: 2, borderRadius: 1, height: 1, boxSizing: "border-box" }}
    >
      <Stack spacing={1.5} sx={{ height: 1, minWidth: 0 }}>
        <Stack
          direction="row"
          spacing={1}
          alignItems="center"
          justifyContent="space-between"
        >
          <Stack
            direction="row"
            spacing={1}
            alignItems="center"
            sx={{ minWidth: 0 }}
          >
            <Avatar
              src={author.avatar_url}
              alt={author.pen_name || "未命名作者"}
              sx={{ width: 32, height: 32 }}
            >
              <PersonIcon fontSize="small" />
            </Avatar>
            <Typography
              variant="h6"
              fontWeight={800}
              sx={{ minWidth: 0, overflowWrap: "anywhere" }}
            >
              {author.pen_name || "未命名作者"}
            </Typography>
          </Stack>
          <Tooltip title={hidden ? "設為公開" : "設為隱藏"}>
            <span>
              <IconButton
                size="small"
                aria-label={hidden ? "設為公開" : "設為隱藏"}
                disabled={saveVisibility.isPending}
                onClick={() => saveVisibility.mutate(!hidden)}
              >
                {hidden ? <VisibilityOffIcon /> : <VisibilityIcon />}
              </IconButton>
            </span>
          </Tooltip>
        </Stack>
        {author.bio && <AuthorBio bio={author.bio} />}
        <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
          <Chip size="small" label={`${author.project_count} 個專案`} />
          <Chip size="small" label={`${author.story_count} 篇故事`} />
          <Chip
            size="small"
            label={`${author.word_count.toLocaleString()} 字`}
          />
          <Chip size="small" label={`${author.rating_count} 人評分`} />
          <Chip
            size="small"
            label={`平均 ${author.average_rating.toFixed(1)}`}
          />
          {hidden && <Chip size="small" color="warning" label="對外隱藏中" />}
        </Stack>
        {author.pen_name && (
          <Button
            component={RouterLink}
            to={steamloomPath(`user/${encodeURIComponent(author.pen_name)}`)}
            variant="contained"
          >
            查看作者
          </Button>
        )}
      </Stack>
    </Paper>
  );
}
