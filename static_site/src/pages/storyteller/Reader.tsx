import AutoStoriesIcon from "@mui/icons-material/AutoStories";
import BookmarkAddIcon from "@mui/icons-material/BookmarkAdd";
import BookmarkAddedIcon from "@mui/icons-material/BookmarkAdded";
import CloseIcon from "@mui/icons-material/Close";
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
import { useState } from "react";
import Markdown from "react-markdown";
import { Link as RouterLink, useParams } from "react-router-dom";
import {
  useSaveStorytellerProjectFavorite,
  usePublicStorytellerProject,
  useSharedStorytellerProject,
  useStorytellerProjectFavorite,
} from "@/apis/storyteller.ts";
import {
  findProjectByPublicPath,
  findProjectByShareToken,
  formatStorytellerDate,
  getProjectStories,
  publicProjectPath,
} from "@/data/storyteller.ts";
import { useTitle } from "@/helpers/title.tsx";
import { ErrorPage } from "@/pages/ErrorPage.tsx";
import { StorytellerShell } from "@/pages/storyteller/StorytellerShell.tsx";

interface ReaderStory {
  id: string;
  title: string;
  summary: string;
  content: string;
  updatedAt: string;
}

interface ReaderProject {
  id: string;
  name: string;
  description: string;
  path: string;
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

export default function StorytellerReader() {
  const { projectPath, shareToken, storyId } = useParams();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("md"));
  const [indexOpen, setIndexOpen] = useState(true);
  const [mobileIndexOpen, setMobileIndexOpen] = useState(false);
  const [favorite, setFavorite] = useState(false);
  const [rating, setRating] = useState<number | null>(4);
  const publicProjectQuery = usePublicStorytellerProject(projectPath);
  const sharedProjectQuery = useSharedStorytellerProject(shareToken);
  const apiProject = projectPath
    ? publicProjectQuery.data
    : shareToken
      ? sharedProjectQuery.data
      : undefined;
  const favoriteQuery = useStorytellerProjectFavorite(apiProject?.public_id);
  const saveFavorite = useSaveStorytellerProjectFavorite(apiProject?.public_id);
  const isFavorited = apiProject
    ? (favoriteQuery.data?.favorited ?? false)
    : favorite;
  const mockProject = projectPath
    ? findProjectByPublicPath(projectPath)
    : shareToken
      ? findProjectByShareToken(shareToken)
      : undefined;
  const project: ReaderProject | undefined = apiProject
    ? {
        id: apiProject.public_id,
        name: apiProject.name,
        description: apiProject.description,
        path: `/storyteller/story/${apiProject.public_id}-${apiProject.slug}`,
        stories: (apiProject.stories ?? []).map((story) => ({
          id: story.public_id,
          title: story.title,
          summary: story.summary,
          content: story.latest_content,
          updatedAt: story.updated_at,
        })),
      }
    : mockProject
      ? {
          id: mockProject.id,
          name: mockProject.name,
          description: mockProject.description,
          path: publicProjectPath(mockProject),
          stories: getProjectStories(mockProject.id).map((story) => ({
            id: story.id,
            title: story.title,
            summary: story.summary,
            content: story.content,
            updatedAt: story.updatedAt,
          })),
        }
      : undefined;
  const stories = project?.stories ?? [];
  const currentStory = storyId
    ? stories.find((story) => story.id === storyId)
    : undefined;
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
    path: projectPath
      ? `/storyteller/story/${projectPath}${storyId ? `/${storyId}` : ""}`
      : shareToken
        ? `/storyteller/story/share/${shareToken}${storyId ? `/${storyId}` : ""}`
        : "",
    robots: isShareRoute ? "noindex, nofollow" : "index, follow",
  });

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
          <Chip label={`${stories.length} 篇故事`} />
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
          {isMobile ? "開啟故事索引" : indexOpen ? "收起故事索引" : "展開故事索引"}
        </Button>
        {currentStory && (
          <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap>
            <Button
              variant={isFavorited ? "contained" : "outlined"}
              startIcon={isFavorited ? <BookmarkAddedIcon /> : <BookmarkAddIcon />}
              disabled={saveFavorite.isPending}
              onClick={() => {
                if (apiProject?.public_id) {
                  saveFavorite.mutate(!isFavorited);
                  return;
                }
                setFavorite((value) => !value);
              }}
            >
              {isFavorited ? "已收藏" : "收藏"}
            </Button>
            <Paper variant="outlined" sx={{ px: 1.5, py: 0.75, borderRadius: 1 }}>
              <Stack direction="row" spacing={1} alignItems="center">
                <Typography variant="body2" color="text.secondary">
                  評分
                </Typography>
                <Rating
                  value={rating}
                  precision={0.5}
                  onChange={(_, value) => setRating(value)}
                />
              </Stack>
            </Paper>
          </Stack>
        )}
      </Stack>

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
          <Paper variant="outlined" sx={{ p: { xs: 2, md: 3 }, borderRadius: 1 }}>
            {currentStory ? (
              <Stack spacing={2}>
                <Box>
                  <Typography component="h1" variant="h4" fontWeight={800}>
                    {currentStory.title}
                  </Typography>
                  <Typography color="text.secondary" sx={{ mt: 1 }}>
                    {currentStory.summary}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    更新於 {formatStorytellerDate(currentStory.updatedAt)}
                  </Typography>
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
                <Grid container spacing={1.5}>
                  <Grid size={{ xs: 12, md: 4 }}>
                    <Paper
                      component={previousStory ? RouterLink : "div"}
                      to={previousStory ? `${basePath}/${previousStory.id}` : undefined}
                      variant="outlined"
                      sx={{
                        display: "block",
                        p: 2,
                        height: 1,
                        borderRadius: 1,
                        textDecoration: "none",
                        color: "inherit",
                        opacity: previousStory ? 1 : 0.55,
                      }}
                    >
                      <Typography variant="caption" color="text.secondary">
                        上一章
                      </Typography>
                      <Typography fontWeight={800} sx={{ mt: 0.5 }}>
                        {previousStory?.title ?? "沒有上一章"}
                      </Typography>
                    </Paper>
                  </Grid>
                  <Grid size={{ xs: 12, md: 4 }}>
                    <Paper
                      variant="outlined"
                      sx={{ p: 2, height: 1, borderRadius: 1 }}
                    >
                      <Typography variant="caption" color="text.secondary">
                        本章
                      </Typography>
                      <Typography fontWeight={800} sx={{ mt: 0.5 }}>
                        {currentStory.title}
                      </Typography>
                    </Paper>
                  </Grid>
                  <Grid size={{ xs: 12, md: 4 }}>
                    <Paper
                      component={nextStory ? RouterLink : "div"}
                      to={nextStory ? `${basePath}/${nextStory.id}` : undefined}
                      variant="outlined"
                      sx={{
                        display: "block",
                        p: 2,
                        height: 1,
                        borderRadius: 1,
                        textDecoration: "none",
                        color: "inherit",
                        opacity: nextStory ? 1 : 0.55,
                      }}
                    >
                      <Typography variant="caption" color="text.secondary">
                        下一章
                      </Typography>
                      <Typography fontWeight={800} sx={{ mt: 0.5 }}>
                        {nextStory?.title ?? "沒有下一章"}
                      </Typography>
                    </Paper>
                  </Grid>
                </Grid>
              </Stack>
            ) : (
              <Stack spacing={2}>
                <Typography component="h1" variant="h4" fontWeight={800}>
                  {project.name}
                </Typography>
                <Typography color="text.secondary">{project.description}</Typography>
                <Divider />
                <Typography>
                  請從左側索引選擇故事章節開始閱讀。
                </Typography>
              </Stack>
            )}
          </Paper>
        </Grid>
      </Grid>
    </StorytellerShell>
  );
}
