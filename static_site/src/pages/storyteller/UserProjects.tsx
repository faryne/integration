import BookmarkAddIcon from "@mui/icons-material/BookmarkAdd";
import BookmarkAddedIcon from "@mui/icons-material/BookmarkAdded";
import FavoriteIcon from "@mui/icons-material/Favorite";
import LanguageIcon from "@mui/icons-material/Language";
import LockOpenIcon from "@mui/icons-material/LockOpen";
import PersonIcon from "@mui/icons-material/Person";
import VisibilityIcon from "@mui/icons-material/Visibility";
import VisibilityOffIcon from "@mui/icons-material/VisibilityOff";
import {
  Avatar,
  Box,
  Button,
  Chip,
  Grid,
  IconButton,
  Pagination,
  Paper,
  Stack,
  Tab,
  Tabs,
  Typography,
} from "@mui/material";
import { useState } from "react";
import {
  Link as RouterLink,
  useParams,
  useSearchParams,
} from "react-router-dom";
import {
  usePublicFavoriteStorytellerAuthors,
  usePublicFavoriteStorytellerProjects,
  usePublicUserStorytellerProjects,
  useSaveFavoriteAuthorVisibility,
  useSaveFavoriteProjectVisibility,
  useSaveStorytellerAuthorFavorite,
  useStorytellerAuthorFavorite,
} from "@/apis/storyteller.ts";
import { useAuth } from "@/components/auth/AuthContext.ts";
import { LoginPromptDialog } from "@/components/auth/LoginPromptDialog.tsx";
import { CustomEmptyState } from "@/components/common/CustomEmptyState.tsx";
import {
  storytellerProjectRatingColor,
  storytellerProjectRatingLabel,
} from "@/data/storyteller.ts";
import { useTitle } from "@/helpers/title.tsx";
import { StorytellerProjectCard } from "@/pages/storyteller/StorytellerProjectCard.tsx";
import {
  StorytellerLoading,
  StorytellerShell,
} from "@/pages/storyteller/StorytellerShell.tsx";
import type {
  StorytellerFavoriteAuthor,
  StorytellerProject,
} from "@/types/storyteller.ts";

const SNS_TYPE_LABEL: Record<string, string> = {
  x: "X",
  facebook: "Facebook",
  instagram: "Instagram",
  threads: "Threads",
  website: "個人網站",
  plurk: "Plurk",
  bahamut: "巴哈姆特",
  discord: "Discord",
  youtube: "YouTube",
};

function formatJoinedMonth(input: string) {
  return new Intl.DateTimeFormat("zh-TW", {
    year: "numeric",
    month: "long",
  }).format(new Date(input));
}

type ProfileTab = "projects" | "favorite-projects" | "favorite-authors";

export default function StorytellerUserProjects() {
  const { session } = useAuth();
  const { username } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const [loginPromptOpen, setLoginPromptOpen] = useState(false);
  const [tab, setTab] = useState<ProfileTab>("projects");
  const page = parseInt(searchParams.get("page") || "1", 10);
  const pageSize = 12;

  const { data, isLoading } = usePublicUserStorytellerProjects(
    username,
    page,
    pageSize,
  );
  const author = data?.author;
  const authorUserId = author?.user_id;
  const isOwner = Boolean(authorUserId && session?.user.id === authorUserId);
  const authorFavoriteQuery = useStorytellerAuthorFavorite(
    isOwner ? undefined : authorUserId,
  );
  const saveAuthorFavorite = useSaveStorytellerAuthorFavorite(
    isOwner ? undefined : authorUserId,
  );
  const isAuthorFavorited = authorFavoriteQuery.data?.favorited ?? false;

  const favoriteProjectsQuery = usePublicFavoriteStorytellerProjects(
    tab === "favorite-projects" ? username : undefined,
  );
  const favoriteAuthorsQuery = usePublicFavoriteStorytellerAuthors(
    tab === "favorite-authors" ? username : undefined,
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
        <StorytellerLoading label="正在載入作者資訊..." />
      </StorytellerShell>
    );
  }

  const items = (data?.items || []).map((project) => ({
    id: project.public_id,
    name: project.name,
    description: project.description,
    storiesCount: project.stories?.length ?? 0,
    rating: project.rating,
    averageRating: project.average_rating,
    favoriteCount: project.favorite_count,
    tags: project.tags ?? [],
    wordCount:
      project.stories?.reduce((total, story) => total + story.word_count, 0) ??
      0,
    updatedAt: project.updated_at,
    path: `/storyteller/story/${project.public_id}-${project.slug}`,
  }));

  const totalPages = Math.ceil((data?.total || 0) / pageSize);
  const displayName = author?.pen_name || username || "作者";
  const joinedLabel = author?.created_at
    ? (author.story_count ?? 0) > 0
      ? `開始說起故事於 ${formatJoinedMonth(author.created_at)}`
      : `開始讀起故事於 ${formatJoinedMonth(author.created_at)}`
    : undefined;
  const snsEntries = Object.entries(author?.sns_links ?? {});

  return (
    <StorytellerShell
      title={displayName}
      description={`${displayName} 在 Storyteller 的公開作者頁。`}
      breadcrumbs={[
        { label: "Storyteller", to: "/storyteller" },
        { label: displayName },
      ]}
      action={
        <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
          {authorUserId && !isOwner && (
            <Button
              variant={isAuthorFavorited ? "contained" : "outlined"}
              startIcon={
                isAuthorFavorited ? <BookmarkAddedIcon /> : <BookmarkAddIcon />
              }
              disabled={saveAuthorFavorite.isPending}
              onClick={() => {
                if (!session) {
                  setLoginPromptOpen(true);
                  return;
                }
                saveAuthorFavorite.mutate(!isAuthorFavorited);
              }}
            >
              {isAuthorFavorited ? "已收藏作者" : "收藏作者"}
            </Button>
          )}
          <Button component={RouterLink} to="/storyteller" variant="outlined">
            回首頁
          </Button>
        </Stack>
      }
    >
      <LoginPromptDialog
        open={loginPromptOpen}
        onClose={() => setLoginPromptOpen(false)}
        description="收藏作者需要登入。是否要現在登入？"
      />
      <Grid container spacing={3}>
        <Grid size={{ xs: 12, md: 4 }}>
          <Paper variant="outlined" sx={{ p: 2, borderRadius: 1 }}>
            <Stack spacing={2}>
              <Stack direction="row" spacing={2} alignItems="center">
                <Avatar
                  src={author?.avatar_url}
                  alt={displayName}
                  sx={{ width: 56, height: 56 }}
                >
                  <PersonIcon />
                </Avatar>
                <Box sx={{ minWidth: 0 }}>
                  <Typography
                    variant="h6"
                    fontWeight={800}
                    sx={{ overflowWrap: "anywhere" }}
                  >
                    {displayName}
                  </Typography>
                  {joinedLabel && (
                    <Typography variant="caption" color="text.secondary">
                      {joinedLabel}
                    </Typography>
                  )}
                </Box>
              </Stack>
              {author?.bio && (
                <Typography
                  color="text.secondary"
                  sx={{ overflowWrap: "anywhere" }}
                >
                  {author.bio}
                </Typography>
              )}
              {snsEntries.length > 0 && (
                <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                  {snsEntries.map(([type, url]) => (
                    <Chip
                      key={type}
                      size="small"
                      icon={<LanguageIcon />}
                      component="a"
                      href={url}
                      target="_blank"
                      rel="noopener noreferrer"
                      clickable
                      label={SNS_TYPE_LABEL[type] ?? type}
                    />
                  ))}
                </Stack>
              )}
              <Stack spacing={1}>
                <Stack direction="row" justifyContent="space-between">
                  <Typography color="text.secondary">作品</Typography>
                  <Typography fontWeight={700}>
                    {author?.project_count ?? 0}
                  </Typography>
                </Stack>
                <Stack direction="row" justifyContent="space-between">
                  <Typography color="text.secondary">字數</Typography>
                  <Typography fontWeight={700}>
                    {(author?.word_count ?? 0).toLocaleString()}
                  </Typography>
                </Stack>
                <Stack direction="row" justifyContent="space-between">
                  <Typography color="text.secondary">平均評分</Typography>
                  <Typography fontWeight={700}>
                    {(author?.average_rating ?? 0).toFixed(1)}
                  </Typography>
                </Stack>
                <Stack direction="row" justifyContent="space-between">
                  <Typography color="text.secondary">被收藏</Typography>
                  <Typography fontWeight={700}>
                    {author?.follower_count ?? 0} 人
                  </Typography>
                </Stack>
              </Stack>
            </Stack>
          </Paper>
        </Grid>

        <Grid size={{ xs: 12, md: 8 }}>
          <Stack spacing={2}>
            <Tabs
              value={tab}
              onChange={(_, value: ProfileTab) => setTab(value)}
              aria-label="作者內容分類"
              variant="scrollable"
              allowScrollButtonsMobile
            >
              <Tab value="projects" label="作品" />
              <Tab value="favorite-projects" label="收藏的作品" />
              <Tab value="favorite-authors" label="收藏的作家" />
            </Tabs>

            {tab === "projects" &&
              (items.length > 0 ? (
                <Stack spacing={3}>
                  <Grid container spacing={2}>
                    {items.map((project) => (
                      <Grid key={project.id} size={{ xs: 12, sm: 6 }}>
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
                                color={storytellerProjectRatingColor(
                                  project.rating,
                                )}
                                label={storytellerProjectRatingLabel(
                                  project.rating,
                                )}
                              />
                              <Chip
                                size="small"
                                label={`${project.storiesCount} 篇故事`}
                              />
                              <Chip
                                size="small"
                                label={`${project.wordCount.toLocaleString()} 字`}
                              />
                              <Chip
                                size="small"
                                label={`平均 ${project.averageRating.toFixed(1)}`}
                              />
                              <Chip
                                size="small"
                                label={`${project.favoriteCount} 人收藏`}
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
                  {totalPages > 1 && (
                    <Box sx={{ display: "flex", justifyContent: "center" }}>
                      <Pagination
                        count={totalPages}
                        page={page}
                        onChange={(_, value) =>
                          setSearchParams({ page: value.toString() })
                        }
                        color="primary"
                      />
                    </Box>
                  )}
                </Stack>
              ) : (
                <CustomEmptyState
                  icon={<LockOpenIcon fontSize="large" />}
                  title="目前沒有公開的作品"
                  description="這位作者公開的 Storyteller 專案會顯示在這裡。"
                />
              ))}

            {tab === "favorite-projects" &&
              (favoriteProjectsQuery.isLoading ? (
                <StorytellerLoading label="正在載入收藏的作品..." />
              ) : (favoriteProjectsQuery.data ?? []).length === 0 ? (
                <CustomEmptyState
                  icon={<FavoriteIcon fontSize="large" />}
                  title="沒有公開的收藏作品"
                  description="這位作者收藏的公開作品會顯示在這裡。"
                />
              ) : (
                <Grid container spacing={2}>
                  {(favoriteProjectsQuery.data ?? []).map((project) => (
                    <Grid key={project.public_id} size={{ xs: 12, sm: 6 }}>
                      <FavoriteProjectCard project={project} isOwner={isOwner} />
                    </Grid>
                  ))}
                </Grid>
              ))}

            {tab === "favorite-authors" &&
              (favoriteAuthorsQuery.isLoading ? (
                <StorytellerLoading label="正在載入收藏的作家..." />
              ) : (favoriteAuthorsQuery.data ?? []).length === 0 ? (
                <CustomEmptyState
                  icon={<PersonIcon fontSize="large" />}
                  title="沒有公開的收藏作家"
                  description="這位作者收藏的作家會顯示在這裡。"
                />
              ) : (
                <Grid container spacing={2}>
                  {(favoriteAuthorsQuery.data ?? []).map((favoriteAuthor) => (
                    <Grid
                      key={favoriteAuthor.user_id}
                      size={{ xs: 12, sm: 6 }}
                    >
                      <FavoriteAuthorCard
                        author={favoriteAuthor}
                        isOwner={isOwner}
                      />
                    </Grid>
                  ))}
                </Grid>
              ))}
          </Stack>
        </Grid>
      </Grid>
    </StorytellerShell>
  );
}

function FavoriteProjectCard({
  project,
  isOwner,
}: {
  project: StorytellerProject;
  isOwner: boolean;
}) {
  const saveVisibility = useSaveFavoriteProjectVisibility(project.public_id);
  const hidden = project.favorite_hidden ?? false;
  const storyCount = project.stories?.length ?? 0;
  const wordCount =
    project.stories?.reduce((total, story) => total + story.word_count, 0) ??
    0;

  return (
    <StorytellerProjectCard
      name={project.name}
      description={project.description}
      updatedAt={project.updated_at}
      authorName={project.author?.pen_name}
      headerAction={
        isOwner && (
          <IconButton
            size="small"
            aria-label={hidden ? "設為公開" : "設為隱藏"}
            disabled={saveVisibility.isPending}
            onClick={() => saveVisibility.mutate(!hidden)}
          >
            {hidden ? <VisibilityOffIcon /> : <VisibilityIcon />}
          </IconButton>
        )
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
          <Chip
            size="small"
            label={`平均 ${project.average_rating.toFixed(1)}`}
          />
          <Chip size="small" label={`${project.favorite_count} 人收藏`} />
          {hidden && <Chip size="small" color="warning" label="對外隱藏中" />}
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
  );
}

function FavoriteAuthorCard({
  author,
  isOwner,
}: {
  author: StorytellerFavoriteAuthor;
  isOwner: boolean;
}) {
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
          <Stack direction="row" spacing={1} alignItems="center" sx={{ minWidth: 0 }}>
            <PersonIcon color="primary" />
            <Typography
              variant="h6"
              fontWeight={800}
              sx={{ minWidth: 0, overflowWrap: "anywhere" }}
            >
              {author.pen_name || "未命名作者"}
            </Typography>
          </Stack>
          {isOwner && (
            <IconButton
              size="small"
              aria-label={hidden ? "設為公開" : "設為隱藏"}
              disabled={saveVisibility.isPending}
              onClick={() => saveVisibility.mutate(!hidden)}
            >
              {hidden ? <VisibilityOffIcon /> : <VisibilityIcon />}
            </IconButton>
          )}
        </Stack>
        {author.bio && (
          <Typography
            color="text.secondary"
            sx={{ flex: 1, minWidth: 0, overflowWrap: "anywhere" }}
          >
            {author.bio}
          </Typography>
        )}
        <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
          <Chip size="small" label={`${author.project_count} 個專案`} />
          <Chip
            size="small"
            label={`${author.word_count.toLocaleString()} 字`}
          />
          <Chip
            size="small"
            label={`平均 ${author.average_rating.toFixed(1)}`}
          />
          <Chip size="small" label={`${author.follower_count} 人收藏`} />
          {hidden && <Chip size="small" color="warning" label="對外隱藏中" />}
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
  );
}
