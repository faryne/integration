import AddIcon from "@mui/icons-material/Add";
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
import { keyframes } from "@mui/material/styles";
import useMediaQuery from "@mui/material/useMediaQuery";
import { useEffect, useState } from "react";
import { Link as RouterLink, useSearchParams } from "react-router-dom";
import {
  usePublicStorytellerProjects,
  useStorytellerProjectSearch,
} from "@/apis/storyteller.ts";
import { CustomEmptyState } from "@/components/common/CustomEmptyState.tsx";
import { GearIcon } from "@/components/storyteller/SteamGearIcon.tsx";
import {
  STORYTELLER_APP_NAME,
  storytellerReaderPath,
} from "@/data/storyteller.ts";
import { steamloomPath } from "@/helpers/steamloom.ts";
import { useTitle } from "@/helpers/title.tsx";
import { StorytellerProjectCard } from "@/pages/storyteller/StorytellerProjectCard.tsx";
import { StorytellerProjectSearchCard } from "@/pages/storyteller/StorytellerProjectSearchCard.tsx";
import { StorytellerLoading } from "@/pages/storyteller/StorytellerShell.tsx";

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
            to={steamloomPath("my/projects/new")}
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
  const { data: publicProjects = [], isLoading } =
    usePublicStorytellerProjects();
  const [searchParams, setSearchParams] = useSearchParams();
  const keyword = searchParams.get("keyword") ?? "";
  const [keywordInput, setKeywordInput] = useState(keyword);
  const isSearching = keyword.trim() !== "";

  // 跟 Search.tsx 同一個理由：這個 route 只靠 query string 換頁不會重新 mount，
  // keywordInput 是 controlled input 自己的狀態，URL 的 keyword 外部變動時要手動同步。
  useEffect(() => {
    setKeywordInput(keyword);
  }, [keyword]);

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
    if (keywordInput.trim()) {
      params.set("keyword", keywordInput.trim());
    } else {
      params.delete("keyword");
    }
    setSearchParams(params);
  }

  return (
    <Stack spacing={3}>
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

      <Stack
        direction={{ xs: "column", sm: "row" }}
        spacing={1.5}
        justifyContent="space-between"
        alignItems={{ xs: "flex-start", sm: "center" }}
      >
        <Typography variant="h5">
          {isSearching ? "搜尋結果" : "已發佈的故事"}
        </Typography>
        {isSearching
          ? !projectSearch.isLoading && (
              <Chip size="small" label={`${searchTotal} 個專案`} />
            )
          : !isLoading && (
              <Chip size="small" label={`${publicProjects.length} 部作品`} />
            )}
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
            <Grid container spacing={2}>
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
        <Grid container spacing={2}>
          {publicProjects.map((project) => (
            <Grid key={project.public_id} size={{ xs: 12, md: 6, lg: 4 }}>
              <StorytellerProjectCard
                project={project}
                extraChips={
                  <Chip size="small" icon={<LockOpenIcon />} label="公開閱讀" />
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
            </Grid>
          ))}
        </Grid>
      )}
    </Stack>
  );
}
