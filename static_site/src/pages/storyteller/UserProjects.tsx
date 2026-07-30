import BookmarkAddIcon from "@mui/icons-material/BookmarkAdd";
import BookmarkAddedIcon from "@mui/icons-material/BookmarkAdded";
import FacebookIcon from "@mui/icons-material/Facebook";
import FavoriteIcon from "@mui/icons-material/Favorite";
import InstagramIcon from "@mui/icons-material/Instagram";
import LanguageIcon from "@mui/icons-material/Language";
import LockOpenIcon from "@mui/icons-material/LockOpen";
import PersonIcon from "@mui/icons-material/Person";
import VisibilityIcon from "@mui/icons-material/Visibility";
import VisibilityOffIcon from "@mui/icons-material/VisibilityOff";
import XIcon from "@mui/icons-material/X";
import YouTubeIcon from "@mui/icons-material/YouTube";
import {
  Avatar,
  Box,
  Button,
  Chip,
  Collapse,
  Grid,
  IconButton,
  Pagination,
  Paper,
  Stack,
  Tab,
  Tabs,
  Tooltip,
  Typography,
} from "@mui/material";
import { useState } from "react";
import {
  Link as RouterLink,
  useLocation,
  useNavigate,
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
  STORYTELLER_APP_NAME,
  storytellerProjectRatingColor,
  storytellerProjectRatingLabel,
  storytellerReaderPath,
} from "@/data/storyteller.ts";
import { steamloomPath } from "@/helpers/steamloom.ts";
import { useTitle } from "@/helpers/title.tsx";
import { ErrorPage } from "@/pages/ErrorPage.tsx";
import { StorytellerMarkdown } from "@/pages/storyteller/StorytellerMarkdown.tsx";
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

// Threads／Plurk／巴哈姆特／Discord 在 MUI icons-material（Material Symbols）裡沒有對應品牌圖示，
// 沒有精確圖示的平台就沿用通用的 LanguageIcon，避免用不相關的圖示誤導使用者。
const SNS_TYPE_ICON: Record<string, typeof LanguageIcon> = {
  x: XIcon,
  facebook: FacebookIcon,
  instagram: InstagramIcon,
  youtube: YouTubeIcon,
};

function formatJoinedMonth(input: string) {
  return new Intl.DateTimeFormat("zh-TW", {
    year: "numeric",
    month: "long",
  }).format(new Date(input));
}

type ProfileTab = "projects" | "favorite-projects" | "favorite-authors";

const tabBreadcrumbLabel: Record<ProfileTab, string> = {
  projects: "作品",
  "favorite-projects": "收藏的作品",
  "favorite-authors": "收藏的作家",
};

export default function StorytellerUserProjects() {
  const { session } = useAuth();
  const { username } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [loginPromptOpen, setLoginPromptOpen] = useState(false);
  const tab: ProfileTab = location.pathname.endsWith("/favorite-projects")
    ? "favorite-projects"
    : location.pathname.endsWith("/favorite-authors")
      ? "favorite-authors"
      : "projects";
  const page = parseInt(searchParams.get("page") || "1", 10);
  const pageSize = 12;

  function handleTabChange(value: ProfileTab) {
    navigate(
      steamloomPath(
        value === "projects" ? `user/${username}` : `user/${username}/${value}`,
      ),
    );
  }

  const { data, isLoading, isError } = usePublicUserStorytellerProjects(
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

  useTitle(`${username} 的作品 - ${STORYTELLER_APP_NAME}`, {
    path: steamloomPath(`user/${username}`),
    robots: "index, follow",
  });

  if (isLoading) {
    return (
      <StorytellerShell
        title={`${username} 的作品`}
        breadcrumbs={[
          { label: STORYTELLER_APP_NAME, to: steamloomPath() },
          { label: username || "作者" },
        ]}
      >
        <StorytellerLoading label="正在載入作者資訊..." />
      </StorytellerShell>
    );
  }

  if (isError || !data?.author) {
    return <ErrorPage code={404} />;
  }

  const items = (data?.items || []).map((project) => ({
    id: project.public_id,
    name: project.name,
    description: project.description,
    storiesCount: (project.stories ?? []).filter(
      (story) => story.content_type !== "image",
    ).length,
    rating: project.rating,
    averageRating: project.average_rating,
    favoriteCount: project.favorite_count,
    tags: project.tags ?? [],
    wordCount:
      project.stories?.reduce((total, story) => total + story.word_count, 0) ??
      0,
    updatedAt: project.updated_at,
    path: storytellerReaderPath(project),
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
      description={author?.bio ? <AuthorBio bio={author.bio} /> : undefined}
      breadcrumbs={[
        { label: STORYTELLER_APP_NAME, to: steamloomPath() },
        { label: displayName, to: steamloomPath(`user/${username}`) },
        { label: tabBreadcrumbLabel[tab] },
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
          <Button
            component={RouterLink}
            to={steamloomPath()}
            variant="outlined"
          >
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
              {snsEntries.length > 0 && (
                <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                  {snsEntries.map(([type, url]) => {
                    const SnsIcon = SNS_TYPE_ICON[type] ?? LanguageIcon;
                    return (
                      <Chip
                        key={type}
                        size="small"
                        icon={<SnsIcon />}
                        component="a"
                        href={url}
                        target="_blank"
                        rel="noopener noreferrer"
                        clickable
                        label={SNS_TYPE_LABEL[type] ?? type}
                      />
                    );
                  })}
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
              onChange={(_, value: ProfileTab) => handleTabChange(value)}
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
                          tags={project.tags}
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
                  description={`這位作者公開的 ${STORYTELLER_APP_NAME} 專案會顯示在這裡。`}
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
                      <FavoriteProjectCard
                        project={project}
                        isOwner={isOwner}
                      />
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
                    <Grid key={favoriteAuthor.user_id} size={{ xs: 12, sm: 6 }}>
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

const BIO_COLLAPSE_THRESHOLD = 160;

export function AuthorBio({ bio }: { bio: string }) {
  const [expanded, setExpanded] = useState(false);
  const isLong = bio.length > BIO_COLLAPSE_THRESHOLD;

  return (
    <Box>
      <Collapse in={expanded || !isLong} collapsedSize={64}>
        <Box sx={{ "& p": { mt: 0, mb: 1 }, "& p:last-child": { mb: 0 } }}>
          <StorytellerMarkdown>{bio}</StorytellerMarkdown>
        </Box>
      </Collapse>
      {isLong && (
        <Button
          size="small"
          onClick={() => setExpanded((value) => !value)}
          sx={{ mt: 0.5, minWidth: 0, px: 0 }}
        >
          {expanded ? "收合簡介" : "顯示完整簡介"}
        </Button>
      )}
    </Box>
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
  const storyCount = (project.stories ?? []).filter(
    (story) => story.content_type !== "image",
  ).length;
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
        isOwner && (
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
          to={storytellerReaderPath(project)}
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
          {isOwner && (
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
          )}
        </Stack>
        {author.bio && <AuthorBio bio={author.bio} />}
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
