import AddIcon from "@mui/icons-material/Add";
import ArrowForwardIcon from "@mui/icons-material/ArrowForward";
import LockOpenIcon from "@mui/icons-material/LockOpen";
import SearchIcon from "@mui/icons-material/Search";
import {
  Box,
  Button,
  Chip,
  Grid,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import useMediaQuery from "@mui/material/useMediaQuery";
import { useEffect, useState } from "react";
import { Link as RouterLink, useSearchParams } from "react-router-dom";
import {
  usePublicStorytellerProjects,
  useStorytellerProjectSearch,
} from "@/apis/storyteller.ts";
import { CustomEmptyState } from "@/components/common/CustomEmptyState.tsx";
import {
  STORYTELLER_APP_NAME,
  storytellerReaderPath,
} from "@/data/storyteller.ts";
import { STORYTELLER_PUBLIC_HOME_COPIES } from "@/data/storytellerPublicHomeCopy.ts";
import { storytellerHomeArtworkSrc } from "@/helpers/storytellerHomeArtwork.ts";
import { steamloomPath } from "@/helpers/steamloom.ts";
import { useTitle } from "@/helpers/title.tsx";
import { useStorytellerAppearance } from "@/layouts/storytellerAppearanceMode.tsx";
import { StorytellerProjectCard } from "@/pages/storyteller/StorytellerProjectCard.tsx";
import { StorytellerProjectSearchCard } from "@/pages/storyteller/StorytellerProjectSearchCard.tsx";
import { StorytellerLoading } from "@/pages/storyteller/StorytellerShell.tsx";

function PublicHomeHero({ projectCount }: { projectCount?: number }) {
  const { appearance } = useStorytellerAppearance();
  const reduceMotion = useMediaQuery("(prefers-reduced-motion: reduce)");
  const [copyIndex, setCopyIndex] = useState(0);
  const copy = STORYTELLER_PUBLIC_HOME_COPIES[copyIndex];

  useEffect(() => {
    const storageKey = "storyteller-home-copy-index";
    const previous = Number(window.sessionStorage.getItem(storageKey));
    let next = Math.floor(
      Math.random() * STORYTELLER_PUBLIC_HOME_COPIES.length,
    );
    if (
      STORYTELLER_PUBLIC_HOME_COPIES.length > 1 &&
      Number.isInteger(previous) &&
      next === previous
    ) {
      next = (next + 1) % STORYTELLER_PUBLIC_HOME_COPIES.length;
    }
    window.sessionStorage.setItem(storageKey, String(next));
    setCopyIndex(next);
  }, []);

  return (
    <Box
      component="section"
      sx={{
        position: "relative",
        display: "grid",
        gridTemplateColumns: {
          xs: "1fr",
          md: "minmax(0, 1.08fr) minmax(340px, .92fr)",
        },
        alignItems: "center",
        gap: { xs: 5, md: 8 },
        px: { xs: 1, sm: 3, md: 6 },
        py: { xs: 7, md: 10 },
        borderBlock: "1px solid",
        borderColor: "divider",
        overflow: "hidden",
        "&::before": {
          content: '""',
          position: "absolute",
          inset: 0,
          opacity: 0.28,
          pointerEvents: "none",
          backgroundImage:
            "linear-gradient(var(--storyteller-border-subtle) 1px, transparent 1px), linear-gradient(90deg, var(--storyteller-border-subtle) 1px, transparent 1px)",
          backgroundSize: "72px 72px",
          maskImage: "linear-gradient(90deg, #000, transparent 76%)",
        },
      }}
    >
      <Stack
        spacing={3}
        sx={{ position: "relative", zIndex: 1, maxWidth: 760 }}
      >
        <Typography
          variant="overline"
          color="primary.main"
          sx={{ letterSpacing: "0.2em", fontWeight: 700 }}
        >
          STORIES / WORLDS / LIVING THREADS
        </Typography>
        <Typography
          component="h1"
          sx={{
            fontFamily: (theme) => theme.typography.h1.fontFamily,
            fontSize: { xs: "3rem", sm: "4rem", lg: "4.8rem" },
            fontWeight: 700,
            lineHeight: 1.05,
            letterSpacing: "-0.055em",
          }}
        >
          {copy.title}
          <Box
            component="span"
            sx={{
              color: "primary.main",
              display: "block",
              textShadow:
                "0 0 34px color-mix(in srgb, var(--storyteller-accent-main) 22%, transparent)",
            }}
          >
            {copy.accent}
          </Box>
        </Typography>
        <Typography
          color="text.secondary"
          sx={{
            maxWidth: 620,
            fontFamily: (theme) => theme.typography.h6.fontFamily,
            fontSize: { xs: 16, sm: 18 },
            lineHeight: 1.9,
          }}
        >
          {copy.lead}
          {typeof projectCount === "number" &&
            ` 目前已有 ${projectCount} 部作品公開發佈。`}
        </Typography>
        <Stack direction="row" spacing={1.5} flexWrap="wrap" useFlexGap>
          <Button
            component={RouterLink}
            to={steamloomPath("my/projects/new")}
            variant="contained"
            startIcon={<AddIcon />}
          >
            開始創作
          </Button>
          <Button
            component={RouterLink}
            to={steamloomPath("my")}
            variant="text"
            endIcon={<ArrowForwardIcon />}
          >
            打開我的工作台
          </Button>
          <Button
            component={RouterLink}
            to={steamloomPath(
              "work/0869d8ef0f2e5306-織夢機房/story/947fa38eb34402fa",
            )}
            variant="text"
          >
            認識梭梭
          </Button>
        </Stack>
      </Stack>

      <Box
        aria-hidden
        sx={{
          position: "relative",
          zIndex: 1,
          minHeight: { xs: 280, sm: 360 },
          overflow: "hidden",
          "&::before": {
            content: '""',
            position: "absolute",
            width: 190,
            height: 190,
            left: "calc(50% - 95px)",
            top: "calc(50% - 95px)",
            border: "1px solid",
            borderColor: "primary.main",
            transform: "rotate(45deg)",
            boxShadow:
              "0 0 50px color-mix(in srgb, var(--storyteller-accent-main) 20%, transparent)",
          },
          "&::after": {
            content: '""',
            position: "absolute",
            width: 300,
            height: 300,
            left: "calc(50% - 150px)",
            top: "calc(50% - 150px)",
            border: "1px dashed",
            borderColor: "divider",
            borderRadius: "50%",
            animation: reduceMotion
              ? "none"
              : "steamloom-orbit 32s linear infinite",
          },
          "@keyframes steamloom-orbit": { to: { transform: "rotate(360deg)" } },
        }}
      >
        <Box
          sx={{
            position: "absolute",
            insetInline: "-20%",
            top: "52%",
            height: "1px",
            bgcolor: "secondary.main",
            transform: "rotate(-14deg)",
            boxShadow: "0 0 18px var(--storyteller-accent-main)",
          }}
        />
        <Box
          component="img"
          src={storytellerHomeArtworkSrc({ appearance })}
          alt=""
          aria-hidden
          sx={{
            position: "absolute",
            inset: 0,
            margin: "auto",
            height: "90%",
            width: "auto",
            maxWidth: "76%",
            objectFit: "contain",
            pointerEvents: "none",
            filter:
              "drop-shadow(0 0 22px color-mix(in srgb, var(--storyteller-accent-main) 22%, transparent))",
          }}
        />
      </Box>
    </Box>
  );
}

export default function StorytellerPublicHome() {
  const { data: publicProjects = [], isLoading } =
    usePublicStorytellerProjects();
  const [searchParams, setSearchParams] = useSearchParams();
  const keyword = searchParams.get("keyword") ?? "";
  const [keywordInput, setKeywordInput] = useState(keyword);
  const isSearching = keyword.trim() !== "";

  useEffect(() => setKeywordInput(keyword), [keyword]);

  const projectSearch = useStorytellerProjectSearch({ keyword }, isSearching);
  const searchResults =
    projectSearch.data?.pages.flatMap((page) => page.data) ?? [];
  const searchTotal = projectSearch.data?.pages[0]?.total ?? 0;

  useTitle(`${STORYTELLER_APP_NAME} 公開故事`, {
    path: steamloomPath(),
    robots: "index, follow",
  });

  function submitKeyword() {
    const params = new URLSearchParams(searchParams);
    if (keywordInput.trim()) params.set("keyword", keywordInput.trim());
    else params.delete("keyword");
    setSearchParams(params);
  }

  return (
    <Stack spacing={{ xs: 4, md: 7 }}>
      <PublicHomeHero
        projectCount={isLoading ? undefined : publicProjects.length}
      />

      <Stack
        component="form"
        direction={{ xs: "column", sm: "row" }}
        spacing={1.5}
        onSubmit={(event) => {
          event.preventDefault();
          submitKeyword();
        }}
        sx={{ px: { xs: 0, md: 3 } }}
      >
        <TextField
          fullWidth
          size="small"
          placeholder="搜尋專案名稱、標題、內文……"
          value={keywordInput}
          onChange={(event) => setKeywordInput(event.target.value)}
          slotProps={{
            input: {
              startAdornment: (
                <SearchIcon
                  fontSize="small"
                  sx={{ mr: 1, color: "text.secondary" }}
                />
              ),
            },
          }}
        />
        <Button type="submit" variant="contained" sx={{ whiteSpace: "nowrap" }}>
          搜尋
        </Button>
        {isSearching && (
          <Button
            component={RouterLink}
            to={steamloomPath(`search?keyword=${encodeURIComponent(keyword)}`)}
            variant="text"
            sx={{ whiteSpace: "nowrap" }}
          >
            進階搜尋
          </Button>
        )}
      </Stack>

      <Stack spacing={3} sx={{ px: { xs: 0, md: 3 }, pb: 5 }}>
        <Stack
          direction={{ xs: "column", sm: "row" }}
          spacing={1.5}
          justifyContent="space-between"
          alignItems={{ xs: "flex-start", sm: "flex-end" }}
        >
          <Box>
            <Typography
              variant="overline"
              color="primary.main"
              sx={{ letterSpacing: "0.16em" }}
            >
              {isSearching ? "SEARCH RESULTS" : "CURATED STORIES"}
            </Typography>
            <Typography variant="h3">
              {isSearching ? "搜尋結果" : "正在發生的故事"}
            </Typography>
          </Box>
          <Typography variant="body2" color="text.secondary">
            {isSearching
              ? !projectSearch.isLoading && `${searchTotal} 個專案`
              : !isLoading && `${publicProjects.length} 部作品`}
          </Typography>
        </Stack>

        {isSearching ? (
          projectSearch.isLoading ? (
            <StorytellerLoading label="正在搜尋..." />
          ) : searchResults.length === 0 ? (
            <CustomEmptyState
              icon={<LockOpenIcon fontSize="large" />}
              title="沒有符合的專案"
              description="換個關鍵字試試，或是清空搜尋框看看全部公開作品。"
            />
          ) : (
            <>
              <Grid container spacing={0}>
                {searchResults.map((result) => (
                  <Grid
                    key={result.project_public_id}
                    size={{ xs: 12, md: 6, lg: 4 }}
                  >
                    <StorytellerProjectSearchCard result={result} />
                  </Grid>
                ))}
              </Grid>
              {projectSearch.hasNextPage && (
                <Stack alignItems="center">
                  <Button
                    variant="outlined"
                    disabled={projectSearch.isFetchingNextPage}
                    onClick={() => void projectSearch.fetchNextPage()}
                  >
                    {projectSearch.isFetchingNextPage
                      ? "載入中..."
                      : "載入更多結果"}
                  </Button>
                </Stack>
              )}
            </>
          )
        ) : isLoading ? (
          <StorytellerLoading label="正在載入公開故事..." />
        ) : publicProjects.length === 0 ? (
          <CustomEmptyState
            icon={<LockOpenIcon fontSize="large" />}
            title="目前還沒有公開創作專案"
            description={`公開的 ${STORYTELLER_APP_NAME} 專案會顯示在這裡。`}
          />
        ) : (
          <Grid container spacing={0}>
            {publicProjects.map((project) => (
              <Grid key={project.public_id} size={{ xs: 12, sm: 6, lg: 4 }}>
                <StorytellerProjectCard
                  project={project}
                  extraChips={
                    <Chip
                      size="small"
                      icon={<LockOpenIcon />}
                      label="公開閱讀"
                    />
                  }
                  actions={
                    <Button
                      component={RouterLink}
                      to={storytellerReaderPath(project)}
                      variant="text"
                      endIcon={<ArrowForwardIcon />}
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
    </Stack>
  );
}
