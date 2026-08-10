import ArticleIcon from "@mui/icons-material/Article";
import CollectionsIcon from "@mui/icons-material/Collections";
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
import { CustomEmptyState } from "@/components/common/CustomEmptyState.tsx";
import { storytellerReaderPath } from "@/data/storyteller.ts";
import { steamloomPath } from "@/helpers/steamloom.ts";
import { StorytellerProjectCard } from "@/pages/storyteller/StorytellerProjectCard.tsx";
import { StorytellerLoading } from "@/pages/storyteller/StorytellerShell.tsx";
import { AuthorBio } from "@/pages/storyteller/UserProjects.tsx";
import type {
  StorytellerFavoriteAuthor,
  StorytellerProject,
} from "@/types/storyteller.ts";

// 「我的追蹤」的內容——掛在 /my 工作台殼底下（見 Home.tsx），登入狀態已經由
// Home.tsx 統一擋過，這裡不用再自己判斷 session。
export function StorytellerFavoritesContent() {
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

  return (
    <Stack spacing={2}>
      <Tabs
        value={tab}
        onChange={(_, value: "stories" | "authors") => setTab(value)}
        aria-label="追蹤分類"
      >
        <Tab value="stories" label="作品" />
        <Tab value="authors" label="作者" />
      </Tabs>

      {isLoading ? (
        <StorytellerLoading
          label={
            tab === "stories" ? "正在載入追蹤作品..." : "正在載入追蹤作者..."
          }
        />
      ) : isError ? (
        <Alert severity="error" variant="outlined">
          讀取追蹤清單失敗，請確認登入狀態後再試一次。
        </Alert>
      ) : tab === "stories" ? (
        projects.length === 0 ? (
          <CustomEmptyState
            icon={<FavoriteIcon fontSize="large" />}
            title="尚未追蹤作品"
            description="在作品閱讀頁按下追蹤後，會在此列出創作專案。"
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
          title="尚未追蹤作者"
          description="在作品閱讀頁按下追蹤作者後，會在此列出作者。"
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
  );
}

function FavoriteProjectCard({ project }: { project: StorytellerProject }) {
  const saveVisibility = useSaveFavoriteProjectVisibility(project.public_id);
  const hidden = project.favorite_hidden ?? false;

  return (
    <StorytellerProjectCard
      project={project}
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
      extraChips={
        hidden && <Chip size="small" color="warning" label="對外隱藏中" />
      }
      actions={
        <Button
          component={RouterLink}
          to={storytellerReaderPath(project)}
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
          <Chip
            size="small"
            variant="outlined"
            icon={<ArticleIcon />}
            label={`${author.story_count} 篇故事`}
          />
          {author.image_story_count > 0 && (
            <Chip
              size="small"
              variant="outlined"
              icon={<CollectionsIcon />}
              label={`${author.image_story_count} 話`}
            />
          )}
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
