import AutoStoriesIcon from "@mui/icons-material/AutoStories";
import BookmarkAddIcon from "@mui/icons-material/BookmarkAdd";
import BookmarkAddedIcon from "@mui/icons-material/BookmarkAdded";
import CloseIcon from "@mui/icons-material/Close";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import ArrowForwardIcon from "@mui/icons-material/ArrowForward";
import MenuBookIcon from "@mui/icons-material/MenuBook";
import {
  Box,
  Button,
  Chip,
  Divider,
  Drawer,
  Grid,
  IconButton,
  Paper,
  Rating,
  Stack,
  Typography,
  useMediaQuery,
  useTheme,
} from "@mui/material";
import { useEffect, useRef, useState } from "react";
import Markdown from "react-markdown";
import { Link as RouterLink, useParams } from "react-router-dom";
import { useAuth } from "@/components/auth/AuthContext.ts";
import { LoginPromptDialog } from "@/components/auth/LoginPromptDialog.tsx";
import {
  useSaveStorytellerProjectFavorite,
  useSaveStorytellerProjectRanking,
  usePublicStorytellerProject,
  useSharedStorytellerProject,
  useStorytellerProjectFavorite,
  useStorytellerProjectRanking,
} from "@/apis/storyteller.ts";
import { formatStorytellerDate } from "@/data/storyteller.ts";
import { useTitle } from "@/helpers/title.tsx";
import { ErrorPage } from "@/pages/ErrorPage.tsx";
import {
  StorytellerLoading,
  StorytellerShell,
} from "@/pages/storyteller/StorytellerShell.tsx";

interface ReaderStory {
  id: string;
  title: string;
  summary: string;
  content: string;
  sort: number;
  updatedAt: string;
}

interface ReaderProject {
  id: string;
  name: string;
  description: string;
  path: string;
  authorPenName?: string;
  wordCount: number;
  stories: ReaderStory[];
}

function StoryIndex({
  stories,
  currentStoryId,
  basePath,
  onNavigate,
}: {
  stories: ReaderStory[];
  currentStoryId?: string;
  basePath: string;
  onNavigate?: () => void;
}) {
  return (
    <Stack spacing={2}>
      <Stack direction="row" spacing={1} alignItems="center">
        <AutoStoriesIcon color="primary" />
        <Typography variant="h6" fontWeight={800}>
          故事索引
        </Typography>
      </Stack>
      <Divider />
      {stories.map((story, index) => (
        <Button
          key={story.id}
          component={RouterLink}
          to={`${basePath}/${story.id}`}
          variant={currentStoryId === story.id ? "contained" : "text"}
          sx={{ justifyContent: "flex-start", textAlign: "left" }}
          onClick={onNavigate}
        >
          {index + 1}. {story.title}
        </Button>
      ))}
    </Stack>
  );
}

function ChapterNavCard({
  label,
  title,
  to,
  disabled = false,
  align = "left",
}: {
  label: string;
  title: string;
  to?: string;
  disabled?: boolean;
  align?: "left" | "center" | "right";
}) {
  const LabelIcon =
    align === "left"
      ? ArrowBackIcon
      : align === "right"
        ? ArrowForwardIcon
        : undefined;

  return (
    <Paper
      component={to ? RouterLink : "div"}
      to={to}
      variant="outlined"
      sx={{
        display: "flex",
        flexDirection: "column",
        justifyContent: "flex-start",
        gap: 0.5,
        px: 1.75,
        py: 1.5,
        minHeight: 40,
        borderRadius: 1,
        textDecoration: "none",
        color: "inherit",
        opacity: disabled ? 0.55 : 1,
        overflow: "hidden",
        textAlign: align,
      }}
    >
      <Stack
        direction="row"
        spacing={0.5}
        alignItems="center"
        justifyContent={
          align === "center"
            ? "center"
            : align === "right"
              ? "flex-end"
              : "flex-start"
        }
        sx={{ color: "text.secondary" }}
      >
        {align === "left" && LabelIcon && <LabelIcon sx={{ fontSize: 14 }} />}
        <Typography variant="caption" color="inherit">
          {label}
        </Typography>
        {align === "right" && LabelIcon && <LabelIcon sx={{ fontSize: 14 }} />}
      </Stack>
      <Typography
        fontWeight={800}
        sx={{
          lineHeight: 1.35,
          overflowWrap: "anywhere",
          wordBreak: "break-word",
          display: "-webkit-box",
          WebkitBoxOrient: "vertical",
          WebkitLineClamp: 2,
          overflow: "hidden",
        }}
      >
        {title}
      </Typography>
    </Paper>
  );
}

export default function StorytellerReader() {
  const { session } = useAuth();
  const params = useParams();
  const { shareToken } = params;
  const routeStoryPath = params["*"];
  const routeStoryParts = routeStoryPath?.split("/").filter(Boolean) ?? [];
  const routeStoryId =
    params.storyId ??
    (routeStoryParts.length > 1
      ? routeStoryParts[routeStoryParts.length - 1]
      : undefined);
  const routeProjectPath = routeStoryPath
    ? routeStoryParts.slice(0, routeStoryId ? -1 : undefined).join("/")
    : params.projectPath;
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("md"));
  const [indexOpen, setIndexOpen] = useState(true);
  const [mobileIndexOpen, setMobileIndexOpen] = useState(false);
  const [favorite, setFavorite] = useState(false);
  const [loginPromptOpen, setLoginPromptOpen] = useState(false);
  const storyStartRef = useRef<HTMLHeadingElement | null>(null);
  const previousStoryIdRef = useRef<string | undefined>(undefined);
  const publicProjectQuery = usePublicStorytellerProject(routeProjectPath);
  const sharedProjectQuery = useSharedStorytellerProject(shareToken);
  const apiProject = routeProjectPath
    ? publicProjectQuery.data
    : shareToken
      ? sharedProjectQuery.data
      : undefined;
  const favoriteQuery = useStorytellerProjectFavorite(apiProject?.public_id);
  const saveFavorite = useSaveStorytellerProjectFavorite(apiProject?.public_id);
  const rankingQuery = useStorytellerProjectRanking(apiProject?.public_id);
  const saveRanking = useSaveStorytellerProjectRanking(apiProject?.public_id);
  const isFavorited = apiProject
    ? (favoriteQuery.data?.favorited ?? false)
    : favorite;
  const rating = rankingQuery.data?.ranking ?? null;
  const project: ReaderProject | undefined = apiProject
    ? {
        id: apiProject.public_id,
        name: apiProject.name,
        description: apiProject.description,
        path: `/storyteller/story/${apiProject.public_id}-${apiProject.slug}`,
        authorPenName: apiProject.author?.pen_name,
        wordCount: (apiProject.stories ?? []).reduce(
          (total, story) => total + story.word_count,
          0,
        ),
        stories: (apiProject.stories ?? []).map((story) => ({
          id: story.public_id,
          title: story.title,
          summary: story.summary,
          content: story.latest_content,
          sort: story.sort,
          updatedAt: story.updated_at,
        })),
      }
    : undefined;
  const stories = project?.stories ?? [];
  const currentStoryId = routeStoryId;
  const currentStory = currentStoryId
    ? stories.find((story) => story.id === currentStoryId)
    : (stories.find((story) => story.sort === 0) ?? stories[0]);
  const currentStoryIndex = currentStory
    ? stories.findIndex((story) => story.id === currentStory.id)
    : -1;
  const previousStory =
    currentStoryIndex > 0 ? stories[currentStoryIndex - 1] : undefined;
  const nextStory =
    currentStoryIndex >= 0 && currentStoryIndex < stories.length - 1
      ? stories[currentStoryIndex + 1]
      : undefined;
  const isShareRoute = Boolean(shareToken);

  useTitle(project ? `${project.name} - Storyteller` : "Storyteller", {
    path: routeProjectPath
      ? `/storyteller/story/${routeProjectPath}${currentStoryId ? `/${currentStoryId}` : ""}`
      : shareToken
        ? `/storyteller/story/share/${shareToken}${currentStoryId ? `/${currentStoryId}` : ""}`
        : "",
    robots: isShareRoute ? "noindex, nofollow" : "index, follow",
  });

  useEffect(() => {
    if (!currentStory?.id) {
      return;
    }
    if (!previousStoryIdRef.current) {
      previousStoryIdRef.current = currentStory.id;
      return;
    }
    if (previousStoryIdRef.current === currentStory.id) {
      return;
    }

    previousStoryIdRef.current = currentStory.id;
    storyStartRef.current?.scrollIntoView({
      behavior: "smooth",
      block: "start",
    });
  }, [currentStory?.id]);

  if (
    !project &&
    (publicProjectQuery.isLoading || sharedProjectQuery.isLoading)
  ) {
    return <StorytellerLoading label="正在載入故事..." />;
  }

  if (!project) {
    return <ErrorPage code={404} />;
  }

  const basePath = isShareRoute
    ? `/storyteller/story/share/${shareToken}`
    : project.path;
  const showInlineIndex = !isMobile && indexOpen;

  return (
    <StorytellerShell
      title={project.name}
      description={project.description}
      breadcrumbs={[
        { label: "Storyteller", to: "/storyteller" },
        { label: project.name },
      ]}
      action={
        <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
          <Chip
            label={isShareRoute ? "專用連結" : "公開閱讀"}
            color={isShareRoute ? "warning" : "success"}
          />
          {project.authorPenName && (
            <Chip
              label={`作者 ${project.authorPenName}`}
              variant="outlined"
              component={RouterLink}
              to={`/storyteller/user/${encodeURIComponent(project.authorPenName)}`}
              clickable
            />
          )}
          <Chip label={`${stories.length} 篇故事`} />
          <Chip label={`${project.wordCount.toLocaleString()} 字`} />
        </Stack>
      }
    >
      {isMobile && (
        <Drawer
          anchor="left"
          open={mobileIndexOpen}
          onClose={() => setMobileIndexOpen(false)}
        >
          <Box sx={{ width: 320, maxWidth: "86vw", p: 2 }}>
            <Stack direction="row" justifyContent="flex-end" sx={{ mb: 1 }}>
              <IconButton
                aria-label="關閉故事索引"
                onClick={() => setMobileIndexOpen(false)}
              >
                <CloseIcon />
              </IconButton>
            </Stack>
            <StoryIndex
              stories={stories}
              currentStoryId={currentStory?.id}
              basePath={basePath}
              onNavigate={() => setMobileIndexOpen(false)}
            />
          </Box>
        </Drawer>
      )}

      <Stack
        direction={{ xs: "column", md: "row" }}
        spacing={1}
        justifyContent="space-between"
        sx={{ mb: 2 }}
      >
        <Button
          variant="outlined"
          startIcon={<MenuBookIcon />}
          onClick={() =>
            isMobile ? setMobileIndexOpen(true) : setIndexOpen((open) => !open)
          }
        >
          {isMobile
            ? "開啟故事索引"
            : indexOpen
              ? "收起故事索引"
              : "展開故事索引"}
        </Button>
        {currentStory && (
          <Stack
            direction="row"
            spacing={1}
            alignItems="center"
            flexWrap="wrap"
            useFlexGap
          >
            <Button
              variant={isFavorited ? "contained" : "outlined"}
              startIcon={
                isFavorited ? <BookmarkAddedIcon /> : <BookmarkAddIcon />
              }
              disabled={saveFavorite.isPending}
              onClick={() => {
                if (!session) {
                  setLoginPromptOpen(true);
                  return;
                }
                if (apiProject?.public_id) {
                  saveFavorite.mutate(!isFavorited);
                  return;
                }
                setFavorite((value) => !value);
              }}
            >
              {isFavorited ? "已收藏" : "收藏"}
            </Button>
            <Paper
              variant="outlined"
              sx={{ px: 1.5, py: 0.75, borderRadius: 1 }}
            >
              <Stack direction="row" spacing={1} alignItems="center">
                <Typography variant="body2" color="text.secondary">
                  評分
                </Typography>
                <Rating
                  value={rating}
                  precision={0.5}
                  disabled={saveRanking.isPending}
                  onChange={(_, value) => {
                    if (!session) {
                      setLoginPromptOpen(true);
                      return;
                    }
                    if (apiProject?.public_id && value !== null) {
                      saveRanking.mutate(value);
                    }
                  }}
                />
              </Stack>
            </Paper>
          </Stack>
        )}
      </Stack>

      <LoginPromptDialog
        open={loginPromptOpen}
        onClose={() => setLoginPromptOpen(false)}
        description="收藏或評分故事需要登入。是否要現在登入？"
      />

      <Grid container spacing={2}>
        {showInlineIndex && (
          <Grid size={{ xs: 12, md: 4 }}>
            <Paper variant="outlined" sx={{ p: 2, borderRadius: 1 }}>
              <StoryIndex
                stories={stories}
                currentStoryId={currentStory?.id}
                basePath={basePath}
              />
            </Paper>
          </Grid>
        )}

        <Grid size={{ xs: 12, md: showInlineIndex ? 8 : 12 }}>
          <Paper
            variant="outlined"
            sx={{ p: { xs: 2, md: 3 }, borderRadius: 1 }}
          >
            {currentStory ? (
              <Stack spacing={2}>
                <Box>
                  <Typography
                    ref={storyStartRef}
                    component="h1"
                    variant="h4"
                    fontWeight={800}
                    sx={{ scrollMarginTop: 24 }}
                  >
                    {currentStory.title}
                  </Typography>
                  <Typography color="text.secondary" sx={{ mt: 1 }}>
                    {currentStory.summary}
                  </Typography>
                  <Stack
                    direction="row"
                    spacing={1}
                    flexWrap="wrap"
                    useFlexGap
                    sx={{ mt: 1 }}
                  >
                    {project.authorPenName && (
                      <Typography
                        variant="caption"
                        color="primary"
                        component={RouterLink}
                        to={`/storyteller/user/${encodeURIComponent(project.authorPenName)}`}
                        sx={{
                          textDecoration: "none",
                          "&:hover": { textDecoration: "underline" },
                        }}
                      >
                        作者 {project.authorPenName}
                      </Typography>
                    )}
                    <Typography variant="caption" color="text.secondary">
                      更新於 {formatStorytellerDate(currentStory.updatedAt)}
                    </Typography>
                  </Stack>
                </Box>
                <Divider />
                <Box
                  sx={{
                    typography: "body1",
                    lineHeight: 1.9,
                    "& h1": { typography: "h5", fontWeight: 800 },
                    "& h2": { typography: "h6", fontWeight: 800, mt: 3 },
                    "& p": { my: 1.5 },
                  }}
                >
                  <Markdown>{currentStory.content}</Markdown>
                </Box>
                <Divider />
                <Box
                  sx={{
                    display: "grid",
                    gridTemplateColumns: {
                      xs: "minmax(0, 1fr)",
                      md: "repeat(3, minmax(0, 1fr))",
                    },
                    gap: 1.5,
                    minWidth: 0,
                  }}
                >
                  <Box sx={{ minWidth: 0 }}>
                    <ChapterNavCard
                      label="上一章"
                      title={previousStory?.title ?? "沒有上一章"}
                      to={
                        previousStory
                          ? `${basePath}/${previousStory.id}`
                          : undefined
                      }
                      disabled={!previousStory}
                      align="left"
                    />
                  </Box>
                  <Box sx={{ minWidth: 0 }}>
                    <ChapterNavCard
                      label="本章"
                      title={currentStory.title}
                      align="center"
                      disabled
                    />
                  </Box>
                  <Box sx={{ minWidth: 0 }}>
                    <ChapterNavCard
                      label="下一章"
                      title={nextStory?.title ?? "沒有下一章"}
                      to={nextStory ? `${basePath}/${nextStory.id}` : undefined}
                      disabled={!nextStory}
                      align="right"
                    />
                  </Box>
                </Box>
              </Stack>
            ) : (
              <Stack spacing={2}>
                <Typography component="h1" variant="h4" fontWeight={800}>
                  {project.name}
                </Typography>
                <Typography color="text.secondary">
                  {project.description}
                </Typography>
                <Divider />
                <Typography>請從左側索引選擇故事章節開始閱讀。</Typography>
              </Stack>
            )}
          </Paper>
        </Grid>
      </Grid>
    </StorytellerShell>
  );
}
