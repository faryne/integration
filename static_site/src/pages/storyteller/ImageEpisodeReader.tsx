import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import ArrowForwardIcon from "@mui/icons-material/ArrowForward";
import CollectionsIcon from "@mui/icons-material/Collections";
import {
  Alert,
  Box,
  Button,
  Chip,
  Grid,
  IconButton,
  Paper,
  Stack,
  Typography,
} from "@mui/material";
import { useEffect, useState } from "react";
import { Link as RouterLink, useParams } from "react-router-dom";
import {
  usePublicStorytellerProject,
  useStorytellerProject,
} from "@/apis/storyteller.ts";
import { useAuth } from "@/components/auth/AuthContext.ts";
import { STORYTELLER_APP_NAME } from "@/data/storyteller.ts";
import { steamloomPath } from "@/helpers/steamloom.ts";
import { useTitle } from "@/helpers/title.tsx";
import { ErrorPage } from "@/pages/ErrorPage.tsx";
import {
  StorytellerLoading,
  StorytellerShell,
} from "@/pages/storyteller/StorytellerShell.tsx";
import { StorytellerTagChips } from "@/pages/storyteller/StorytellerTagChips.tsx";
import {
  getImageEpisode,
  listImageEpisodes,
} from "@/pages/storyteller/storytellerImageEpisodeMock.ts";

export default function StorytellerImageEpisodeReader() {
  const { projectPath, episodeId } = useParams();
  const { session } = useAuth();
  const publicProjectQuery = usePublicStorytellerProject(
    projectPath ?? undefined,
  );
  const projectPublicId = projectPath?.split("-", 1)[0];
  // 私人專案（預設可見度）在公開閱讀 API 查不到，跟 Reader.tsx 一樣：
  // 公開查詢確定沒有資料、且有登入時，才用擁有者專用 API 補查一次私人預覽。
  const shouldLoadOwnerProject = Boolean(
    projectPublicId &&
    session?.encrypt_key &&
    !publicProjectQuery.isLoading &&
    !publicProjectQuery.data,
  );
  const ownerProjectQuery = useStorytellerProject(
    shouldLoadOwnerProject ? projectPublicId : undefined,
  );
  const project = publicProjectQuery.data ?? ownerProjectQuery.data;
  const isLoading = publicProjectQuery.isLoading || ownerProjectQuery.isLoading;
  const episode = getImageEpisode(project?.public_id, episodeId);
  const episodes = listImageEpisodes(project?.public_id);
  const episodeIndex = episode
    ? episodes.findIndex((item) => item.id === episode.id)
    : -1;
  const previousEpisode =
    episodeIndex > 0 ? episodes[episodeIndex - 1] : undefined;
  const nextEpisode =
    episodeIndex >= 0 && episodeIndex < episodes.length - 1
      ? episodes[episodeIndex + 1]
      : undefined;
  const [pageIndex, setPageIndex] = useState(0);

  useEffect(() => {
    setPageIndex(0);
  }, [episodeId]);

  useTitle(
    project && episode
      ? `${episode.title} - ${project.name} | ${STORYTELLER_APP_NAME}`
      : STORYTELLER_APP_NAME,
    { robots: "noindex, nofollow" },
  );

  const shellBreadcrumbs = [
    { label: STORYTELLER_APP_NAME, to: steamloomPath() },
    ...(project ? [{ label: project.name }] : []),
  ];

  if (isLoading) {
    return (
      <StorytellerShell title="圖像作品" breadcrumbs={shellBreadcrumbs}>
        <StorytellerLoading label="正在載入作品資料..." />
      </StorytellerShell>
    );
  }

  if (!project) {
    return <ErrorPage code={404} />;
  }

  if (!episode) {
    return (
      <StorytellerShell title="圖像作品" breadcrumbs={shellBreadcrumbs}>
        <Alert severity="warning" variant="outlined">
          找不到這一話：這個閱讀頁只是
          mockup，內容存在建立當下那台裝置的瀏覽器裡，換一台裝置或清過瀏覽器資料就會看不到。
        </Alert>
      </StorytellerShell>
    );
  }

  const totalPages = episode.pageDataUrls.length;

  function goToPage(index: number) {
    setPageIndex(Math.min(Math.max(index, 0), totalPages - 1));
  }

  return (
    <StorytellerShell
      title={episode.title}
      breadcrumbs={shellBreadcrumbs}
      meta={
        <>
          <Chip label="圖像閱讀 Mockup" color="warning" />
          <Chip
            label={project.name}
            component={RouterLink}
            to={steamloomPath(`story/${project.public_id}-${project.slug}`)}
            variant="outlined"
            clickable
          />
        </>
      }
    >
      <Stack spacing={2}>
        <Alert severity="info" variant="outlined">
          這個閱讀頁只是
          mockup：圖片來自這台裝置瀏覽器裡的暫存資料，還沒有接上真正的後端與
          CDN。
        </Alert>
        <Grid container spacing={2}>
          <Grid size={{ xs: 12, md: 8 }}>
            <Paper
              variant="outlined"
              sx={{
                p: 2,
                borderRadius: 1,
                display: "flex",
                flexDirection: "column",
                gap: 1.5,
              }}
            >
              <Stack
                direction="row"
                justifyContent="space-between"
                alignItems="center"
              >
                <Typography variant="h6" fontWeight={800} noWrap>
                  {episode.title}
                </Typography>
                <Typography
                  variant="body2"
                  color="text.secondary"
                  sx={{ fontFamily: "monospace" }}
                >
                  {String(pageIndex + 1).padStart(3, "0")} /{" "}
                  {String(totalPages).padStart(3, "0")}
                </Typography>
              </Stack>
              <Box
                sx={{
                  position: "relative",
                  bgcolor: "background.default",
                  borderRadius: 1,
                  overflow: "hidden",
                  display: "flex",
                  justifyContent: "center",
                }}
              >
                <Box
                  component="img"
                  src={episode.pageDataUrls[pageIndex]}
                  alt={`第 ${pageIndex + 1} 頁`}
                  sx={{
                    maxWidth: "100%",
                    maxHeight: "70vh",
                    display: "block",
                  }}
                />
                <Box
                  onClick={() => goToPage(pageIndex - 1)}
                  sx={{
                    position: "absolute",
                    left: 0,
                    top: 0,
                    bottom: 0,
                    width: "50%",
                    cursor: pageIndex > 0 ? "pointer" : "default",
                  }}
                />
                <Box
                  onClick={() => goToPage(pageIndex + 1)}
                  sx={{
                    position: "absolute",
                    right: 0,
                    top: 0,
                    bottom: 0,
                    width: "50%",
                    cursor: pageIndex < totalPages - 1 ? "pointer" : "default",
                  }}
                />
              </Box>
              <Stack direction="row" justifyContent="space-between">
                <IconButton
                  disabled={pageIndex === 0}
                  onClick={() => goToPage(pageIndex - 1)}
                >
                  <ArrowBackIcon />
                </IconButton>
                <IconButton
                  disabled={pageIndex >= totalPages - 1}
                  onClick={() => goToPage(pageIndex + 1)}
                >
                  <ArrowForwardIcon />
                </IconButton>
              </Stack>
              <Stack direction="row" flexWrap="wrap" useFlexGap spacing={1}>
                {episode.pageDataUrls.map((url, index) => (
                  <Box
                    key={index}
                    component="img"
                    src={url}
                    alt={`縮圖 ${index + 1}`}
                    onClick={() => goToPage(index)}
                    sx={{
                      width: 56,
                      height: 76,
                      objectFit: "cover",
                      borderRadius: 0.5,
                      cursor: "pointer",
                      border: "2px solid",
                      borderColor:
                        index === pageIndex ? "primary.main" : "transparent",
                    }}
                  />
                ))}
              </Stack>
            </Paper>
          </Grid>
          <Grid size={{ xs: 12, md: 4 }}>
            <Paper variant="outlined" sx={{ p: 2, borderRadius: 1 }}>
              <Stack spacing={1.5}>
                <Stack direction="row" spacing={1} alignItems="center">
                  <CollectionsIcon color="primary" />
                  <Typography variant="subtitle1" fontWeight={800}>
                    作品資訊
                  </Typography>
                </Stack>
                {episode.summary && (
                  <Typography variant="body2" color="text.secondary">
                    {episode.summary}
                  </Typography>
                )}
                <StorytellerTagChips tags={episode.tags} />
                <Stack direction="row" spacing={1}>
                  <Button
                    fullWidth
                    variant="outlined"
                    disabled={!previousEpisode}
                    component={previousEpisode ? RouterLink : "button"}
                    to={
                      previousEpisode
                        ? steamloomPath(
                            `story/${project.public_id}-${project.slug}/image/${previousEpisode.id}`,
                          )
                        : undefined
                    }
                  >
                    上一話
                  </Button>
                  <Button
                    fullWidth
                    variant="outlined"
                    disabled={!nextEpisode}
                    component={nextEpisode ? RouterLink : "button"}
                    to={
                      nextEpisode
                        ? steamloomPath(
                            `story/${project.public_id}-${project.slug}/image/${nextEpisode.id}`,
                          )
                        : undefined
                    }
                  >
                    下一話
                  </Button>
                </Stack>
                <Button
                  component={RouterLink}
                  to={steamloomPath(
                    `story/${project.public_id}-${project.slug}`,
                  )}
                >
                  回到作品首頁
                </Button>
              </Stack>
            </Paper>
          </Grid>
        </Grid>
      </Stack>
    </StorytellerShell>
  );
}
