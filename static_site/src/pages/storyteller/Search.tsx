import SearchIcon from "@mui/icons-material/Search";
import LockOpenIcon from "@mui/icons-material/LockOpen";
import {
  Box,
  Button,
  Chip,
  Grid,
  Stack,
  Tab,
  Tabs,
  TextField,
  Typography,
  MenuItem,
} from "@mui/material";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useSearchParams } from "react-router-dom";
import {
  useStorytellerProjectSearch,
  useStorytellerSearch,
} from "@/apis/storyteller.ts";
import { CustomEmptyState } from "@/components/common/CustomEmptyState.tsx";
import { STORYTELLER_APP_NAME } from "@/data/storyteller.ts";
import { steamloomPath } from "@/helpers/steamloom.ts";
import { steamTabIndicatorSx } from "@/data/storytellerTheme.ts";
import { useTitle } from "@/helpers/title.tsx";
import { StorytellerLoading } from "@/pages/storyteller/StorytellerShell.tsx";
import { StorytellerProjectSearchCard } from "@/pages/storyteller/StorytellerProjectSearchCard.tsx";
import { StorytellerWorkCard } from "@/pages/storyteller/StorytellerWorkCard.tsx";

type SearchView = "story" | "project";

export default function StorytellerSearch() {
  const { t } = useTranslation();
  const ratingOptions = ["", "general", "guidance", "restricted"].map((value) => ({
    value,
    label: t(`web.search.ratings.${value || "all"}`),
  }));
  const [searchParams, setSearchParams] = useSearchParams();
  const keyword = searchParams.get("keyword") ?? "";
  const tag = searchParams.get("tag") ?? "";
  const rating = searchParams.get("rating") ?? "";
  const view: SearchView =
    searchParams.get("view") === "project" ? "project" : "story";
  const [keywordInput, setKeywordInput] = useState(keyword);

  // 這個頁面在同一個 route 上只靠 query string 換頁時不會重新 mount（例如從 header
  // 的展開式搜尋框再送出一次），keywordInput 是 controlled input 自己的狀態，不會
  // 因為 URL 的 keyword 變了就自動同步，這裡補上，不然畫面上的輸入框會停留在舊字，
  // 跟實際套用的關鍵字（下面查詢用的 keyword）對不起來。
  useEffect(() => {
    setKeywordInput(keyword);
  }, [keyword]);

  useTitle(`${t("web.search.pageTitle")} - ${STORYTELLER_APP_NAME}`, {
    path: steamloomPath("search"),
    robots: "noindex, nofollow",
  });

  const storySearch = useStorytellerSearch(
    { keyword, tag, rating },
    view === "story",
  );
  const projectSearch = useStorytellerProjectSearch(
    { keyword, tag, rating },
    view === "project",
  );
  const search = view === "story" ? storySearch : projectSearch;
  const storyResults =
    storySearch.data?.pages.flatMap((page) => page.data) ?? [];
  const projectResults =
    projectSearch.data?.pages.flatMap((page) => page.data) ?? [];
  const results = view === "story" ? storyResults : projectResults;
  const total = search.data?.pages[0]?.total ?? 0;

  function applyFilters(next: {
    keyword?: string;
    tag?: string;
    rating?: string;
    view?: string;
  }) {
    const params = new URLSearchParams(searchParams);
    const merged = { keyword, tag, rating, view, ...next };
    (["keyword", "tag", "rating"] as const).forEach((key) => {
      if (merged[key]) {
        params.set(key, merged[key]!);
      } else {
        params.delete(key);
      }
    });
    if (merged.view === "project") {
      params.set("view", "project");
    } else {
      params.delete("view");
    }
    setSearchParams(params);
  }

  return (
    <Stack spacing={3}>
      <Box
        sx={{
          position: "relative",
          p: 3,
          borderRadius: 1,
          border: "1px solid",
          borderColor: "divider",
          bgcolor: "background.paper",
          "&::before": {
            content: '""',
            position: "absolute",
            insetInline: 0,
            top: 0,
            height: 3,
            borderRadius: "3px 3px 0 0",
            background: (theme) =>
              `linear-gradient(90deg, ${theme.palette.primary.main}, ${theme.palette.secondary.main})`,
          },
        }}
      >
        <Typography variant="h5" fontWeight={800} gutterBottom>
          {t("web.search.pageTitle")}
        </Typography>
        <Typography color="text.secondary" sx={{ mb: 2 }}>
          {t("web.search.description")}
        </Typography>
        <Stack
          component="form"
          direction={{ xs: "column", sm: "row" }}
          spacing={1.5}
          onSubmit={(event) => {
            event.preventDefault();
            applyFilters({ keyword: keywordInput });
          }}
        >
          <TextField
            fullWidth
            placeholder={t("web.search.placeholder")}
            value={keywordInput}
            onChange={(event) => setKeywordInput(event.target.value)}
            slotProps={{
              input: {
                startAdornment: (
                  <SearchIcon fontSize="small" sx={{ mr: 1, color: "text.secondary" }} />
                ),
              },
            }}
          />
          <TextField
            select
            sx={{ minWidth: { sm: 160 } }}
            label={t("web.search.rating")}
            value={rating}
            onChange={(event) => applyFilters({ rating: event.target.value })}
          >
            {ratingOptions.map((option) => (
              <MenuItem key={option.value} value={option.value}>
                {option.label}
              </MenuItem>
            ))}
          </TextField>
          <Button type="submit" variant="contained" sx={{ whiteSpace: "nowrap" }}>
            {t("web.common.search")}
          </Button>
        </Stack>
        {tag && (
          <Stack direction="row" spacing={1} sx={{ mt: 2 }}>
            <Chip
              label={t("web.search.tag", { tag })}
              onDelete={() => applyFilters({ tag: "" })}
            />
          </Stack>
        )}
      </Box>

      <Tabs
        value={view}
        onChange={(_, nextView: SearchView) => applyFilters({ view: nextView })}
        sx={steamTabIndicatorSx}
      >
        <Tab value="story" label={t("web.search.byStory")} />
        <Tab value="project" label={t("web.search.byProject")} />
      </Tabs>

      {!search.isLoading && (
        <Stack
          direction="row"
          justifyContent="space-between"
          alignItems="baseline"
          color="text.secondary"
        >
          <Typography variant="body2">
            {t(view === "story" ? "web.search.storyCount" : "web.search.projectCount", { count: total })}
          </Typography>
        </Stack>
      )}

      {search.isLoading ? (
        <StorytellerLoading label={t("web.search.searching")} />
      ) : results.length === 0 ? (
        <CustomEmptyState
          icon={<LockOpenIcon fontSize="large" />}
          title={t("web.search.emptyTitle")}
          description={t("web.search.emptyDescription")}
        />
      ) : view === "story" ? (
        <>
          <Grid container spacing={2}>
            {storyResults.map((result) => (
              <Grid key={result.story_public_id} size={{ xs: 12, sm: 6, md: 4 }}>
                <StorytellerWorkCard
                  result={result}
                  onTagClick={(nextTag) => applyFilters({ tag: nextTag })}
                />
              </Grid>
            ))}
          </Grid>
          {storySearch.hasNextPage && (
            <Stack alignItems="center">
              <Button
                variant="outlined"
                disabled={storySearch.isFetchingNextPage}
                onClick={() => void storySearch.fetchNextPage()}
              >
                {storySearch.isFetchingNextPage ? t("web.common.loading") : t("web.search.loadMore")}
              </Button>
            </Stack>
          )}
        </>
      ) : (
        <>
          <Grid container spacing={2}>
            {projectResults.map((result) => (
              <Grid key={result.project_public_id} size={{ xs: 12, sm: 6, md: 4 }}>
                <StorytellerProjectSearchCard
                  result={result}
                  onTagClick={(nextTag) => applyFilters({ tag: nextTag })}
                />
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
                {projectSearch.isFetchingNextPage ? t("web.common.loading") : t("web.search.loadMore")}
              </Button>
            </Stack>
          )}
        </>
      )}
    </Stack>
  );
}
