import CollectionsIcon from "@mui/icons-material/Collections";
import { Box, Button, Chip, Paper, Stack, Typography } from "@mui/material";
import { Link as RouterLink, useParams } from "react-router-dom";
import {
  usePublicStorytellerProject,
  useStorytellerProject,
} from "@/apis/storyteller.ts";
import { useAuth } from "@/components/auth/AuthContext.ts";
import { CustomEmptyState } from "@/components/common/CustomEmptyState.tsx";
import {
  STORYTELLER_APP_NAME,
  storytellerProjectRatingColor,
  storytellerProjectRatingLabel,
} from "@/data/storyteller.ts";
import { steamloomPath } from "@/helpers/steamloom.ts";
import { useTitle } from "@/helpers/title.tsx";
import { ErrorPage } from "@/pages/ErrorPage.tsx";
import {
  StorytellerLoading,
  StorytellerShell,
} from "@/pages/storyteller/StorytellerShell.tsx";
import { StorytellerTagChips } from "@/pages/storyteller/StorytellerTagChips.tsx";
import { listImageEpisodes } from "@/pages/storyteller/storytellerImageEpisodeMock.ts";

export default function StorytellerImageEpisodeList() {
  const { projectPath } = useParams();
  const { session } = useAuth();
  const publicProjectQuery = usePublicStorytellerProject(
    projectPath ?? undefined,
  );
  const projectPublicId = projectPath?.split("-", 1)[0];
  // 私人專案（預設可見度）在公開閱讀 API 查不到，跟 Reader.tsx／ImageEpisodeReader.tsx
  // 一樣：公開查詢確定沒有資料、且有登入時，才用擁有者專用 API 補查一次私人預覽。
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
  const episodes = listImageEpisodes(project?.public_id);
  const basePath = project
    ? steamloomPath(`story/${project.public_id}-${project.slug}`)
    : undefined;

  useTitle(
    project
      ? `${project.name} - 圖像作品 | ${STORYTELLER_APP_NAME}`
      : STORYTELLER_APP_NAME,
    { robots: "noindex, nofollow" },
  );

  const shellBreadcrumbs = [
    { label: STORYTELLER_APP_NAME, to: steamloomPath() },
    ...(project ? [{ label: project.name, to: basePath }] : []),
    { label: "圖像作品" },
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

  const readerBasePath = steamloomPath(
    `story/${project.public_id}-${project.slug}`,
  );

  return (
    <StorytellerShell
      title={project.name}
      breadcrumbs={shellBreadcrumbs}
      meta={
        <>
          <Chip label="圖像作品 Mockup" color="warning" />
          {project.author?.pen_name && (
            <Chip
              label={`作者 ${project.author.pen_name}`}
              variant="outlined"
              component={RouterLink}
              to={steamloomPath(
                `user/${encodeURIComponent(project.author.pen_name)}`,
              )}
              clickable
            />
          )}
          <Chip label={`${episodes.length} 話`} />
          <Chip
            label={storytellerProjectRatingLabel(project.rating)}
            color={storytellerProjectRatingColor(project.rating)}
            variant="outlined"
          />
          <Chip
            label="查看文字故事"
            variant="outlined"
            component={RouterLink}
            to={readerBasePath}
            clickable
          />
          <Box sx={{ flexBasis: "100%" }}>
            <StorytellerTagChips tags={project.tags} sx={{ mt: 1 }} />
          </Box>
        </>
      }
    >
      <Stack spacing={2}>
        {episodes.length === 0 ? (
          <CustomEmptyState
            icon={<CollectionsIcon fontSize="large" />}
            title="尚未有圖像作品"
            description="這個專案目前還沒有公開的圖像作品（目前是 mockup，只會顯示建立當下那台裝置上的資料）。"
          />
        ) : (
          <Paper variant="outlined" sx={{ p: 2, borderRadius: 1 }}>
            <Stack spacing={1}>
              <Stack direction="row" spacing={1} alignItems="center">
                <CollectionsIcon color="primary" />
                <Typography variant="h6" fontWeight={800}>
                  圖像作品目次
                </Typography>
              </Stack>
              <Stack spacing={1}>
                {episodes.map((episode) => (
                  <Button
                    key={episode.id}
                    component={RouterLink}
                    to={`${readerBasePath}/image/${episode.id}`}
                    variant="outlined"
                    sx={{
                      justifyContent: "flex-start",
                      textAlign: "left",
                      p: 1.5,
                    }}
                  >
                    <Stack
                      direction="row"
                      spacing={1.5}
                      alignItems="center"
                      sx={{ width: 1 }}
                    >
                      {episode.pageDataUrls[0] ? (
                        <Box
                          component="img"
                          src={episode.pageDataUrls[0]}
                          alt={episode.title}
                          sx={{
                            width: 48,
                            height: 64,
                            objectFit: "cover",
                            borderRadius: 0.5,
                            flexShrink: 0,
                          }}
                        />
                      ) : (
                        <Box
                          sx={{
                            width: 48,
                            height: 64,
                            borderRadius: 0.5,
                            bgcolor: "action.hover",
                            flexShrink: 0,
                          }}
                        />
                      )}
                      <Stack sx={{ minWidth: 0, flex: 1 }}>
                        <Typography fontWeight={700} noWrap>
                          {episode.title}
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                          {episode.pageDataUrls.length} 頁
                        </Typography>
                        <StorytellerTagChips tags={episode.tags} />
                      </Stack>
                    </Stack>
                  </Button>
                ))}
              </Stack>
            </Stack>
          </Paper>
        )}
      </Stack>
    </StorytellerShell>
  );
}
