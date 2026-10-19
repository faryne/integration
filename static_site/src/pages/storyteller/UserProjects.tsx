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
import { useTranslation } from "react-i18next";
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
  useSaveFavoriteProjectVisibility,
} from "@/apis/storyteller.ts";
import { LoginPromptDialog } from "@/components/auth/LoginPromptDialog.tsx";
import { CustomEmptyState } from "@/components/common/CustomEmptyState.tsx";
import { CustomSnackbar } from "@/components/common/CustomSnackbar.tsx";
import { AuthorTimeline } from "@/components/storyteller/timeline/AuthorTimeline.tsx";
import {
  STORYTELLER_APP_NAME,
  storytellerReaderPath,
} from "@/data/storyteller.ts";
import { steamloomCreatorPath, steamloomPath } from "@/helpers/steamloom.ts";
import { steamloomCreatorSeo } from "@/helpers/steamloomCreatorSeo.ts";
import { useTitle } from "@/helpers/title.tsx";
import { ErrorPage } from "@/pages/ErrorPage.tsx";
import { ReportMenuButton } from "@/components/storyteller/report/ReportMenuButton.tsx";
import { FollowAuthorButton } from "@/pages/storyteller/FollowAuthorButton.tsx";
import { AuthorBio } from "@/pages/storyteller/StorytellerAuthorBio.tsx";
import { StorytellerFavoriteAuthorCard } from "@/pages/storyteller/StorytellerFavoriteAuthorCard.tsx";
import { StorytellerProjectCard } from "@/pages/storyteller/StorytellerProjectCard.tsx";
import {
  StorytellerLoading,
  StorytellerShell,
} from "@/pages/storyteller/StorytellerShell.tsx";
import type { StorytellerProject } from "@/types/storyteller.ts";

const SNS_TYPE_LABEL: Record<string, string> = {
  x: "X",
  facebook: "Facebook",
  instagram: "Instagram",
  threads: "Threads",
  website: "Website",
  plurk: "Plurk",
  bahamut: "Bahamut",
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

function formatJoinedMonth(input: string, language?: string) {
  return new Intl.DateTimeFormat(language, {
    year: "numeric",
    month: "long",
  }).format(new Date(input));
}

type ProfileTab =
  "projects" | "posts" | "favorite-projects" | "favorite-authors";

const tabBreadcrumbKey: Record<ProfileTab, string> = {
  projects: "web.community.tabs.projects",
  posts: "web.community.tabs.posts",
  "favorite-projects": "web.community.tabs.favoriteProjects",
  "favorite-authors": "web.community.tabs.favoriteAuthors",
};

export default function StorytellerUserProjects() {
  const { t, i18n } = useTranslation();
  const { username } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  // 登入提示的文案依觸發點不同（追蹤／按讚）；空字串＝關閉
  const [loginPrompt, setLoginPrompt] = useState("");
  const [followSnack, setFollowSnack] = useState("");
  const [followSnackSeverity, setFollowSnackSeverity] = useState<
    "success" | "error"
  >("success");
  function notify(message: string, severity: "success" | "error" = "success") {
    setFollowSnackSeverity(severity);
    setFollowSnack(message);
  }
  const tab: ProfileTab = location.pathname.endsWith("/favorite-projects")
    ? "favorite-projects"
    : location.pathname.endsWith("/favorite-authors")
      ? "favorite-authors"
      : location.pathname.endsWith("/posts")
        ? "posts"
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
  const isOwner = Boolean(author?.is_owner);
  const showFavoriteTabs = Boolean(author?.show_favorites);
  // 筆名作者頁不公開收藏；擁有者自己看時多一個「此筆名追蹤的作家」分頁，管理以筆名做的追蹤
  const isPenNameOwner = isOwner && !showFavoriteTabs;
  // 動態分頁所有人都看得到；收藏分頁只有本人身份的作者頁公開
  const activeTab: ProfileTab =
    tab === "posts" ||
    showFavoriteTabs ||
    (isPenNameOwner && tab === "favorite-authors")
      ? tab
      : "projects";

  const favoriteProjectsQuery = usePublicFavoriteStorytellerProjects(
    activeTab === "favorite-projects" ? username : undefined,
  );
  const favoriteAuthorsQuery = usePublicFavoriteStorytellerAuthors(
    activeTab === "favorite-authors" ? username : undefined,
  );

  // 標題、描述跟後端社群預覽卡同一套格式；筆名不存在時 noindex，避免 soft 404
  const authorPenName = data?.author?.pen_name ?? username ?? "";
  const seo = steamloomCreatorSeo(authorPenName, activeTab, data?.author?.bio);
  useTitle(seo.title, {
    path:
      activeTab === "projects"
        ? steamloomCreatorPath(authorPenName)
        : `${steamloomCreatorPath(authorPenName)}/${activeTab}`,
    description: seo.description,
    type: "profile",
    robots:
      isError || (!isLoading && !data?.author)
        ? "noindex, nofollow"
        : "index, follow",
  });

  if (isLoading) {
    return (
      <StorytellerShell
        title={t("web.community.authorWorks", { name: username })}
        breadcrumbs={[
          { label: STORYTELLER_APP_NAME, to: steamloomPath() },
          { label: username || t("web.community.author") },
        ]}
      >
        <StorytellerLoading label={t("web.community.loadingAuthor")} />
      </StorytellerShell>
    );
  }

  if (isError || !data?.author) {
    return <ErrorPage code={404} />;
  }

  const items = data?.items || [];

  const totalPages = Math.ceil((data?.total || 0) / pageSize);
  const displayName = author?.pen_name || username || t("web.community.author");
  const joinedLabel = author?.created_at
    ? (author.story_count ?? 0) > 0
      ? t("web.community.joinedAsAuthor", { date: formatJoinedMonth(author.created_at, i18n.resolvedLanguage) })
      : t("web.community.joinedAsReader", { date: formatJoinedMonth(author.created_at, i18n.resolvedLanguage) })
    : undefined;
  const snsEntries = Object.entries(author?.sns_links ?? {});

  return (
    <StorytellerShell
      title={displayName}
      description={author?.bio ? <AuthorBio bio={author.bio} /> : undefined}
      breadcrumbs={[
        { label: STORYTELLER_APP_NAME, to: steamloomPath() },
        { label: displayName, to: steamloomPath(`user/${username}`) },
        {
          label:
            isPenNameOwner && activeTab === "favorite-authors"
              ? t("web.community.tabs.penNameFavoriteAuthors")
              : t(tabBreadcrumbKey[activeTab]),
        },
      ]}
      action={
        <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
          {author?.pen_name && (
            <FollowAuthorButton
              penName={author.pen_name}
              disabled={isOwner}
              onLoginRequired={() =>
                setLoginPrompt(t("web.community.followLogin"))
              }
              onNotify={notify}
            />
          )}
          <Button
            component={RouterLink}
            to={steamloomPath()}
            variant="outlined"
          >
            {t("web.community.home")}
          </Button>
          {author?.pen_name && !isOwner && (
            <ReportMenuButton
              target={{
                type: "author",
                publicId: author.pen_name,
                name: author.pen_name,
              }}
            />
          )}
        </Stack>
      }
    >
      <LoginPromptDialog
        open={Boolean(loginPrompt)}
        onClose={() => setLoginPrompt("")}
        description={loginPrompt}
      />
      <CustomSnackbar
        open={Boolean(followSnack)}
        message={followSnack}
        severity={followSnackSeverity}
        onClose={() => setFollowSnack("")}
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
                  <Typography color="text.secondary">{t("web.community.stats.works")}</Typography>
                  <Typography fontWeight={700}>
                    {author?.project_count ?? 0}
                  </Typography>
                </Stack>
                <Stack direction="row" justifyContent="space-between">
                  <Typography color="text.secondary">{t("web.community.stats.stories")}</Typography>
                  <Typography fontWeight={700}>
                    {author?.story_count ?? 0}
                  </Typography>
                </Stack>
                <Stack direction="row" justifyContent="space-between">
                  <Typography color="text.secondary">{t("web.community.stats.images")}</Typography>
                  <Typography fontWeight={700}>
                    {author?.image_story_count ?? 0}
                  </Typography>
                </Stack>
                <Stack direction="row" justifyContent="space-between">
                  <Typography color="text.secondary">{t("web.community.stats.average")}</Typography>
                  <Typography fontWeight={700}>
                    {(author?.average_rating ?? 0).toFixed(1)}
                  </Typography>
                </Stack>
                <Stack direction="row" justifyContent="space-between">
                  <Typography color="text.secondary">{t("web.community.stats.followers")}</Typography>
                  <Typography fontWeight={700}>
                    {t("web.community.stats.people", { count: author?.follower_count ?? 0 })}
                  </Typography>
                </Stack>
              </Stack>
            </Stack>
          </Paper>
        </Grid>

        <Grid size={{ xs: 12, md: 8 }}>
          <Stack spacing={2}>
            <Tabs
              value={activeTab}
              onChange={(_, value: ProfileTab) => handleTabChange(value)}
              aria-label={t("web.community.categoryAria")}
              variant="scrollable"
              allowScrollButtonsMobile
            >
              <Tab value="projects" label={t("web.community.tabs.projects")} />
              <Tab value="posts" label={t("web.community.tabs.posts")} />
              {showFavoriteTabs && (
                <Tab value="favorite-projects" label={t("web.community.tabs.favoriteProjects")} />
              )}
              {(showFavoriteTabs || isPenNameOwner) && (
                <Tab
                  value="favorite-authors"
                  label={t(isPenNameOwner ? "web.community.tabs.penNameFavoriteAuthors" : "web.community.tabs.favoriteAuthors")}
                />
              )}
            </Tabs>

            {activeTab === "projects" &&
              (items.length > 0 ? (
                <Stack spacing={3}>
                  <Grid container spacing={2}>
                    {items.map((project) => (
                      <Grid key={project.public_id} size={{ xs: 12, sm: 6 }}>
                        <StorytellerProjectCard
                          project={project}
                          extraChips={
                            <Chip
                              size="small"
                              icon={<LockOpenIcon />}
                              label={t("web.community.publicReading")}
                            />
                          }
                          actions={
                            <Button
                              component={RouterLink}
                              to={storytellerReaderPath(project)}
                              variant="contained"
                            >
                              {t("web.community.startReading")}
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
                  title={t("web.community.noWorks")}
                  description={t("web.community.noWorksDescription", { appName: STORYTELLER_APP_NAME })}
                />
              ))}

            {activeTab === "posts" && author && (
              <AuthorTimeline
                author={author}
                isOwner={isOwner}
                onNotify={notify}
                onLoginRequired={() =>
                  setLoginPrompt(t("web.community.interactionLogin"))
                }
              />
            )}

            {activeTab === "favorite-projects" &&
              (favoriteProjectsQuery.isLoading ? (
                <StorytellerLoading label={t("web.community.loadingFavoriteProjects")} />
              ) : (favoriteProjectsQuery.data ?? []).length === 0 ? (
                <CustomEmptyState
                  icon={<FavoriteIcon fontSize="large" />}
                  title={t("web.community.noFavoriteProjects")}
                  description={t("web.community.noFavoriteProjectsDescription")}
                />
              ) : (
                <Grid container spacing={2}>
                  {(favoriteProjectsQuery.data ?? []).map((project) => (
                    <Grid key={project.public_id} size={{ xs: 12, sm: 6 }}>
                      <FavoriteProjectCard
                        project={project}
                        isOwner={isOwner}
                        onVisibilityChanged={notify}
                      />
                    </Grid>
                  ))}
                </Grid>
              ))}

            {activeTab === "favorite-authors" &&
              (favoriteAuthorsQuery.isLoading ? (
                <StorytellerLoading label={t("web.community.loadingFavoriteAuthors")} />
              ) : (favoriteAuthorsQuery.data ?? []).length === 0 ? (
                <CustomEmptyState
                  icon={<PersonIcon fontSize="large" />}
                  title={
                    isPenNameOwner
                      ? t("web.community.noPenNameFavoriteAuthors")
                      : t("web.community.noFavoriteAuthors")
                  }
                  description={
                    isPenNameOwner
                      ? t("web.community.privateFavoriteAuthorsDescription")
                      : t("web.community.favoriteAuthorsDescription")
                  }
                />
              ) : (
                <Grid container spacing={2}>
                  {(favoriteAuthorsQuery.data ?? []).map((favoriteAuthor) => (
                    <Grid
                      key={favoriteAuthor.pen_name}
                      size={{ xs: 12, sm: 6 }}
                    >
                      <StorytellerFavoriteAuthorCard
                        author={favoriteAuthor}
                        canToggleVisibility={isOwner && !isPenNameOwner}
                        unfollowAs={
                          isPenNameOwner ? author?.pen_name : undefined
                        }
                        onNotify={notify}
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
  onVisibilityChanged,
}: {
  project: StorytellerProject;
  isOwner: boolean;
  onVisibilityChanged: (
    message: string,
    severity?: "success" | "error",
  ) => void;
}) {
  const { t } = useTranslation();
  const saveVisibility = useSaveFavoriteProjectVisibility(project.public_id);
  const hidden = project.favorite_hidden ?? false;

  return (
    <StorytellerProjectCard
      project={project}
      headerAction={
        isOwner && (
          <Tooltip title={hidden ? t("web.community.makePublic") : t("web.community.makePrivate")}>
            <span>
              <IconButton
                size="small"
                aria-label={hidden ? t("web.community.makePublic") : t("web.community.makePrivate")}
                disabled={saveVisibility.isPending}
                onClick={() =>
                  saveVisibility.mutate(!hidden, {
                    onSuccess: () =>
                      onVisibilityChanged(
                        hidden
                          ? t("web.community.madePublic")
                          : t("web.community.madePrivate"),
                      ),
                    onError: () =>
                      onVisibilityChanged(
                        t("web.community.projectVisibilityFailed"),
                        "error",
                      ),
                  })
                }
              >
                {hidden ? <VisibilityOffIcon /> : <VisibilityIcon />}
              </IconButton>
            </span>
          </Tooltip>
        )
      }
      extraChips={
        hidden && <Chip size="small" color="warning" label={t("web.community.hidden")} />
      }
      actions={
        <Button
          component={RouterLink}
          to={storytellerReaderPath(project)}
          variant="contained"
        >
          {t("web.community.startReading")}
        </Button>
      }
    />
  );
}
