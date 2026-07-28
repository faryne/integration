import AddIcon from "@mui/icons-material/Add";
import LockOpenIcon from "@mui/icons-material/LockOpen";
import { Box, Button, Chip, Grid, Stack, Typography } from "@mui/material";
import { keyframes } from "@mui/material/styles";
import useMediaQuery from "@mui/material/useMediaQuery";
import { Link as RouterLink } from "react-router-dom";
import { usePublicStorytellerProjects } from "@/apis/storyteller.ts";
import { CustomEmptyState } from "@/components/common/CustomEmptyState.tsx";
import { GearIcon } from "@/components/storyteller/SteamGearIcon.tsx";
import {
  STORYTELLER_APP_NAME,
  storytellerProjectRatingColor,
  storytellerProjectRatingLabel,
  storytellerReaderPath,
} from "@/data/storyteller.ts";
import { steamloomPath } from "@/helpers/steamloom.ts";
import { useTitle } from "@/helpers/title.tsx";
import { StorytellerProjectCard } from "@/pages/storyteller/StorytellerProjectCard.tsx";
import { StorytellerLoading } from "@/pages/storyteller/StorytellerShell.tsx";
import { listImageEpisodes } from "@/pages/storyteller/storytellerImageEpisodeMock.ts";

const spin = keyframes`to { transform: rotate(360deg); }`;
const spinReverse = keyframes`to { transform: rotate(-360deg); }`;
const rise = keyframes`
  0% { transform: translateY(0) scale(0.6); opacity: 0; }
  20% { opacity: 0.7; }
  100% { transform: translateY(-160px) scale(1.6); opacity: 0; }
`;

// Hero 只在公開首頁用，故意不抽到共用元件——目前只有這裡需要蒸汽／齒輪這組裝飾。
function PublicHomeHero({ projectCount }: { projectCount?: number }) {
  const reduceMotion = useMediaQuery("(prefers-reduced-motion: reduce)");

  return (
    <Box
      sx={{
        position: "relative",
        overflow: "hidden",
        textAlign: "center",
        px: 3,
        py: { xs: 8, md: 11 },
        mb: 3,
        borderRadius: 1,
        border: "1px solid",
        borderColor: "divider",
        background: (theme) =>
          `radial-gradient(ellipse 70% 60% at 50% 0%, ${theme.palette.mode === "dark" ? "rgba(201,151,79,0.12)" : "rgba(138,90,31,0.08)"}, transparent 60%), ${theme.palette.background.paper}`,
      }}
    >
      <Box
        aria-hidden
        sx={{
          position: "absolute",
          top: -110,
          right: -110,
          width: 340,
          height: 340,
          color: "primary.main",
          opacity: 0.14,
          animation: reduceMotion ? "none" : `${spin} 90s linear infinite`,
        }}
      >
        <GearIcon teeth={12} />
      </Box>
      <Box
        aria-hidden
        sx={{
          position: "absolute",
          bottom: -140,
          left: -140,
          width: 280,
          height: 280,
          color: "secondary.main",
          opacity: 0.14,
          animation: reduceMotion
            ? "none"
            : `${spinReverse} 70s linear infinite`,
        }}
      >
        <GearIcon teeth={9} />
      </Box>
      {!reduceMotion && (
        <Box
          aria-hidden
          sx={{
            position: "absolute",
            left: "50%",
            bottom: "34%",
            pointerEvents: "none",
          }}
        >
          {[0, 2.1, 4.3].map((delay, index) => (
            <Box
              key={delay}
              sx={{
                position: "absolute",
                bottom: 0,
                left: index === 1 ? 26 : index === 2 ? -24 : 0,
                width: 32 - index * 4,
                height: 32 - index * 4,
                borderRadius: "50%",
                background: (theme) =>
                  `radial-gradient(circle, ${theme.palette.mode === "dark" ? "rgba(240,230,210,0.22)" : "rgba(90,70,40,0.16)"}, transparent 70%)`,
                filter: "blur(6px)",
                animation: `${rise} 7s ease-in infinite`,
                animationDelay: `${delay}s`,
              }}
            />
          ))}
        </Box>
      )}

      <Stack
        spacing={2.5}
        alignItems="center"
        sx={{ position: "relative", maxWidth: 620, mx: "auto" }}
      >
        <Typography
          variant="overline"
          sx={{
            color: "secondary.main",
            letterSpacing: "0.22em",
            fontFamily: "monospace",
          }}
        >
          故事，以蒸汽動力紡織
        </Typography>
        <Typography variant="h2" sx={{ color: "primary.light" }}>
          {STORYTELLER_APP_NAME}
        </Typography>
        <Typography
          color="text.secondary"
          sx={{ fontSize: 17, lineHeight: 1.85 }}
        >
          每個故事都是一次紡織：經線是你的世界觀，緯線是角色的選擇，AI Agent
          只是那具負責供給動力的蒸汽引擎——真正決定花色的，永遠是坐在織機前的你。
          {typeof projectCount === "number" &&
            `目前已有 ${projectCount} 部作品公開發佈。`}
        </Typography>
        <Stack
          direction="row"
          spacing={1.5}
          flexWrap="wrap"
          justifyContent="center"
        >
          <Button
            component={RouterLink}
            to={steamloomPath("my/project/new")}
            variant="contained"
            startIcon={<AddIcon />}
          >
            建立創作專案
          </Button>
          <Button
            component={RouterLink}
            to={steamloomPath("my")}
            variant="outlined"
          >
            我的工作台
          </Button>
        </Stack>
      </Stack>
    </Box>
  );
}

export default function StorytellerPublicHome() {
  const { data: apiProjects = [], isLoading } = usePublicStorytellerProjects();
  const publicProjects = apiProjects.map((project) => ({
    id: project.public_id,
    name: project.name,
    description: project.description,
    storiesCount: project.stories?.length ?? 0,
    rating: project.rating,
    tags: project.tags ?? [],
    authorName: project.author?.pen_name,
    wordCount:
      project.stories?.reduce((total, story) => total + story.word_count, 0) ??
      0,
    updatedAt: project.updated_at,
    path: storytellerReaderPath(
      project,
      project.stories?.length ?? 0,
      listImageEpisodes(project.public_id).length,
    ),
  }));

  useTitle(`${STORYTELLER_APP_NAME} 公開故事`, {
    path: steamloomPath(),
    robots: "index, follow",
  });

  return (
    <Stack spacing={3}>
      <PublicHomeHero
        projectCount={isLoading ? undefined : publicProjects.length}
      />

      <Stack
        direction={{ xs: "column", sm: "row" }}
        spacing={1.5}
        justifyContent="space-between"
        alignItems={{ xs: "flex-start", sm: "center" }}
      >
        <Typography variant="h5">已發佈的故事</Typography>
        {!isLoading && (
          <Chip size="small" label={`${publicProjects.length} 部作品`} />
        )}
      </Stack>

      {isLoading ? (
        <StorytellerLoading label="正在載入公開故事..." />
      ) : publicProjects.length === 0 ? (
        <CustomEmptyState
          icon={<LockOpenIcon fontSize="large" />}
          title="目前還沒有公開創作專案"
          description={`公開的 ${STORYTELLER_APP_NAME} 專案會顯示在這裡。`}
        />
      ) : (
        <Grid container spacing={2}>
          {publicProjects.map((project) => (
            <Grid key={project.id} size={{ xs: 12, md: 6, lg: 4 }}>
              <StorytellerProjectCard
                name={project.name}
                description={project.description}
                updatedAt={project.updatedAt}
                authorName={project.authorName}
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
                      color={storytellerProjectRatingColor(project.rating)}
                      label={storytellerProjectRatingLabel(project.rating)}
                    />
                    <Chip
                      size="small"
                      label={`${project.storiesCount} 篇故事`}
                    />
                    <Chip
                      size="small"
                      label={`${project.wordCount.toLocaleString()} 字`}
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
      )}
    </Stack>
  );
}
