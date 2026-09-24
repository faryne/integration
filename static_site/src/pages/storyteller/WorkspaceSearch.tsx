import ArticleOutlinedIcon from "@mui/icons-material/ArticleOutlined";
import ArrowForwardIcon from "@mui/icons-material/ArrowForward";
import CloseIcon from "@mui/icons-material/Close";
import CollectionsBookmarkOutlinedIcon from "@mui/icons-material/CollectionsBookmarkOutlined";
import ImageOutlinedIcon from "@mui/icons-material/ImageOutlined";
import SearchIcon from "@mui/icons-material/Search";
import {
  Autocomplete,
  Box,
  Button,
  Chip,
  CircularProgress,
  Dialog,
  DialogContent,
  Divider,
  IconButton,
  InputAdornment,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Stack,
  TextField,
  Tooltip,
  Typography,
  useMediaQuery,
} from "@mui/material";
import { alpha, useTheme } from "@mui/material/styles";
import { useEffect, useState, type KeyboardEvent } from "react";
import { useStorytellerWorkspaceSearch } from "@/apis/storyteller.ts";
import { CustomSnackbar } from "@/components/common/CustomSnackbar.tsx";
import { formatStorytellerDate } from "@/data/storyteller.ts";
import type {
  StorytellerWorkspaceSearchKind,
  StorytellerWorkspaceSearchResult,
} from "@/types/storyteller.ts";
import {
  readWorkspaceSearchHistory,
  saveWorkspaceSearchHistory,
} from "./workspaceSearchHistory.ts";
import { HighlightedSearchText } from "./WorkspaceSearchHighlight.tsx";

type WorkspaceSearchFilter = "all" | StorytellerWorkspaceSearchKind;

interface WorkspaceSearchProps {
  projectName: string;
  projectPublicId: string;
  onOpenResult: (
    result: StorytellerWorkspaceSearchResult,
    beforeNavigate: () => void,
  ) => void;
}

const workspaceSearchKeywordLimit = 100;

const searchFilters: Array<{ value: WorkspaceSearchFilter; label: string }> = [
  { value: "all", label: "全部" },
  { value: "story", label: "作品" },
  { value: "lore", label: "設定" },
  { value: "asset", label: "資產" },
];

const resultIcons = {
  story: <ArticleOutlinedIcon fontSize="small" />,
  lore: <CollectionsBookmarkOutlinedIcon fontSize="small" />,
  asset: <ImageOutlinedIcon fontSize="small" />,
};

const resultLabels = { story: "作品", lore: "設定", asset: "資產" };

export function WorkspaceSearch({
  projectName,
  projectPublicId,
  onOpenResult,
}: WorkspaceSearchProps) {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("sm"));
  const [open, setOpen] = useState(false);
  const [keyword, setKeyword] = useState("");
  const [debouncedKeyword, setDebouncedKeyword] = useState("");
  const [filter, setFilter] = useState<WorkspaceSearchFilter>("all");
  const [selectedResultId, setSelectedResultId] = useState("");
  const [recentKeywords, setRecentKeywords] = useState<string[]>([]);
  const [errorSnackOpen, setErrorSnackOpen] = useState(false);
  const search = useStorytellerWorkspaceSearch(
    projectPublicId,
    debouncedKeyword,
    filter === "all" ? undefined : filter,
  );
  const keywordIsDebounced = keyword.trim() === debouncedKeyword;
  const results = keywordIsDebounced ? (search.data ?? []) : [];
  const selectedResult =
    results.find(
      (result) => `${result.kind}:${result.public_id}` === selectedResultId,
    ) ?? results[0];

  // 打字時延遲 250ms 才送 API，避免每個注音組字或鍵盤輸入都建立一個請求。
  useEffect(() => {
    const timer = window.setTimeout(
      () => setDebouncedKeyword(keyword.trim()),
      250,
    );
    return () => window.clearTimeout(timer);
  }, [keyword]);

  useEffect(() => {
    if (search.isError) {
      setErrorSnackOpen(true);
    }
  }, [search.isError]);

  function showSearch() {
    setRecentKeywords(readWorkspaceSearchHistory(projectPublicId));
    setOpen(true);
  }

  function closeSearch() {
    setOpen(false);
    setKeyword("");
    setDebouncedKeyword("");
    setFilter("all");
    setSelectedResultId("");
  }

  function rememberKeyword(value = keyword) {
    setRecentKeywords(saveWorkspaceSearchHistory(projectPublicId, value));
  }

  function openResult(result: StorytellerWorkspaceSearchResult) {
    rememberKeyword();
    // 真正獲准 navigation 時才清掉搜尋狀態；若未存檔確認選擇「繼續編輯」，
    // 使用者會回到原本的搜尋結果，不必重新輸入關鍵字。
    onOpenResult(result, closeSearch);
  }

  function handleSearchKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.nativeEvent.isComposing) return;
    if (
      (event.key === "ArrowDown" || event.key === "ArrowUp") &&
      results.length > 0
    ) {
      event.preventDefault();
      const currentIndex = selectedResult
        ? results.findIndex(
            (result) =>
              result.kind === selectedResult.kind &&
              result.public_id === selectedResult.public_id,
          )
        : 0;
      const offset = event.key === "ArrowDown" ? 1 : -1;
      const next =
        results[(currentIndex + offset + results.length) % results.length];
      setSelectedResultId(`${next.kind}:${next.public_id}`);
      return;
    }
    if (
      event.key === "Enter" &&
      selectedResult &&
      debouncedKeyword &&
      keywordIsDebounced &&
      !search.isFetching
    ) {
      event.preventDefault();
      openResult(selectedResult);
      return;
    }
    if (event.key === "Enter") rememberKeyword();
  }

  return (
    <>
      <Tooltip title="搜尋目前專案">
        <IconButton
          aria-label="搜尋目前專案"
          color="inherit"
          size="small"
          onClick={showSearch}
          sx={{ display: { xs: "inline-flex", sm: "none" } }}
        >
          <SearchIcon fontSize="small" />
        </IconButton>
      </Tooltip>
      <Button
        color="inherit"
        size="small"
        startIcon={<SearchIcon fontSize="small" />}
        onClick={showSearch}
        sx={{
          display: { xs: "none", sm: "inline-flex" },
          whiteSpace: "nowrap",
        }}
      >
        搜尋目前專案
      </Button>

      <Dialog
        open={open}
        onClose={closeSearch}
        fullWidth
        maxWidth="md"
        aria-labelledby="workspace-search-title"
        slotProps={{
          container: {
            sx: { alignItems: "flex-start", pt: { xs: 1.5, sm: "8vh" } },
          },
          paper: {
            sx: {
              m: { xs: 1.5, sm: 3 },
              maxHeight: { xs: "calc(100% - 24px)", sm: "min(680px, 86vh)" },
              bgcolor: "background.paper",
              backgroundImage: "none",
              border: 1,
              borderColor: "divider",
            },
          },
        }}
      >
        <Stack
          direction="row"
          alignItems="center"
          justifyContent="space-between"
          spacing={2}
          sx={{ px: { xs: 2, sm: 2.5 }, pt: 2, pb: 1.5 }}
        >
          <Box sx={{ minWidth: 0 }}>
            <Typography id="workspace-search-title" variant="h6" noWrap>
              搜尋這個專案
            </Typography>
            <Typography variant="body2" color="text.secondary" noWrap>
              {projectName}
            </Typography>
          </Box>
          <IconButton aria-label="關閉搜尋" onClick={closeSearch}>
            <CloseIcon />
          </IconButton>
        </Stack>

        <DialogContent sx={{ px: { xs: 2, sm: 2.5 }, pt: 0, pb: 2.5 }}>
          <Autocomplete
            freeSolo
            openOnFocus
            options={keyword ? [] : recentKeywords}
            inputValue={keyword}
            onInputChange={(_, value) => {
              setKeyword(value);
              setSelectedResultId("");
            }}
            onChange={(_, value) => {
              if (typeof value === "string") {
                setKeyword(value);
                setSelectedResultId("");
                rememberKeyword(value);
              }
            }}
            renderInput={(params) => (
              <TextField
                {...params}
                autoFocus
                fullWidth
                placeholder="搜尋作品、設定、資產……"
                onKeyDown={handleSearchKeyDown}
                slotProps={{
                  htmlInput: {
                    ...params.inputProps,
                    maxLength: workspaceSearchKeywordLimit,
                  },
                  input: {
                    ...params.InputProps,
                    startAdornment: (
                      <InputAdornment position="start">
                        <SearchIcon color="primary" />
                      </InputAdornment>
                    ),
                    endAdornment: (
                      <>
                        {search.isFetching && <CircularProgress size={18} />}
                        {params.InputProps.endAdornment}
                      </>
                    ),
                  },
                }}
              />
            )}
          />

          <Stack
            direction="row"
            spacing={1}
            sx={{ py: 1.5, overflowX: "auto" }}
          >
            {searchFilters.map(({ value, label }) => (
              <Chip
                key={value}
                label={label}
                color={filter === value ? "primary" : "default"}
                variant={filter === value ? "filled" : "outlined"}
                onClick={() => {
                  setFilter(value);
                  setSelectedResultId("");
                }}
              />
            ))}
          </Stack>
          <Divider />

          {!debouncedKeyword ? (
            <Typography variant="body2" color="text.secondary" sx={{ pt: 2 }}>
              搜尋範圍只包含目前專案，不會混入其他公開作品。
            </Typography>
          ) : !keywordIsDebounced || search.isLoading ? (
            <Stack alignItems="center" spacing={1.5} sx={{ py: 6 }}>
              <CircularProgress size={28} />
              <Typography variant="body2" color="text.secondary">
                正在搜尋工作台……
              </Typography>
            </Stack>
          ) : results.length > 0 ? (
            <Box
              sx={{
                display: "grid",
                gridTemplateColumns: {
                  xs: "minmax(0, 1fr)",
                  sm: "minmax(0, .95fr) minmax(280px, 1.05fr)",
                },
                minHeight: { sm: 330 },
              }}
            >
              <Box
                sx={{
                  pt: 1,
                  pr: { sm: 1.5 },
                  borderRight: { sm: 1 },
                  borderColor: "divider",
                }}
              >
                <Typography
                  variant="caption"
                  color="text.secondary"
                  sx={{ px: 1 }}
                >
                  找到 {results.length} 筆結果
                </Typography>
                <List disablePadding sx={{ mt: 0.5 }}>
                  {results.map((result) => {
                    const resultId = `${result.kind}:${result.public_id}`;
                    return (
                      <ListItemButton
                        key={resultId}
                        selected={
                          selectedResult?.public_id === result.public_id &&
                          selectedResult.kind === result.kind
                        }
                        onClick={() =>
                          isMobile
                            ? openResult(result)
                            : setSelectedResultId(resultId)
                        }
                        sx={{
                          px: 1,
                          py: 1.25,
                          borderRadius: 1,
                          alignItems: "flex-start",
                          "&:hover, &.Mui-selected, &.Mui-selected:hover": {
                            bgcolor: (theme) =>
                              alpha(theme.palette.primary.main, 0.1),
                          },
                        }}
                      >
                        <ListItemIcon
                          sx={{ minWidth: 36, color: "primary.main", mt: 0.25 }}
                        >
                          {resultIcons[result.kind]}
                        </ListItemIcon>
                        <ListItemText
                          primary={
                            <HighlightedSearchText
                              text={result.title}
                              keyword={keyword}
                            />
                          }
                          secondary={
                            <HighlightedSearchText
                              text={result.context || result.location}
                              keyword={keyword}
                            />
                          }
                          primaryTypographyProps={{ fontWeight: 800 }}
                          secondaryTypographyProps={{ sx: { mt: 0.25 } }}
                        />
                        <Chip
                          label={resultLabels[result.kind]}
                          size="small"
                          variant="outlined"
                          sx={{ ml: 1 }}
                        />
                      </ListItemButton>
                    );
                  })}
                </List>
              </Box>

              {!isMobile && selectedResult && (
                <Stack
                  component="section"
                  aria-label="搜尋結果預覽"
                  spacing={2}
                  sx={{ pt: { xs: 2, sm: 1 }, pl: { sm: 2 }, minWidth: 0 }}
                >
                  <Box>
                    <Typography variant="overline" color="text.secondary">
                      搜尋結果 Preview
                    </Typography>
                    <Stack
                      direction="row"
                      alignItems="flex-start"
                      spacing={1}
                      sx={{ mt: 0.5 }}
                    >
                      <Box
                        sx={{ color: "primary.main", lineHeight: 0, pt: 0.5 }}
                      >
                        {resultIcons[selectedResult.kind]}
                      </Box>
                      <Box sx={{ minWidth: 0 }}>
                        <Typography variant="h6">
                          <HighlightedSearchText
                            text={selectedResult.title}
                            keyword={keyword}
                          />
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          {selectedResult.location}
                        </Typography>
                      </Box>
                    </Stack>
                  </Box>
                  <Box
                    sx={{
                      p: 1.5,
                      borderLeft: 2,
                      borderColor: "primary.main",
                      bgcolor: (theme) =>
                        alpha(theme.palette.primary.main, 0.06),
                    }}
                  >
                    <Typography variant="body2" sx={{ lineHeight: 1.8 }}>
                      <HighlightedSearchText
                        text={
                          selectedResult.preview ||
                          "這筆內容沒有可顯示的文字預覽。"
                        }
                        keyword={keyword}
                      />
                    </Typography>
                  </Box>
                  <Typography variant="caption" color="text.secondary">
                    最後更新：{formatStorytellerDate(selectedResult.updated_at)}
                  </Typography>
                  <Button
                    variant="contained"
                    endIcon={<ArrowForwardIcon />}
                    onClick={() => openResult(selectedResult)}
                    sx={{ alignSelf: "flex-start" }}
                  >
                    在工作台開啟
                  </Button>
                </Stack>
              )}
            </Box>
          ) : (
            <Stack
              alignItems="center"
              spacing={1}
              sx={{ py: 5, textAlign: "center" }}
            >
              <SearchIcon color="disabled" sx={{ fontSize: 40 }} />
              <Typography fontWeight={800}>找不到符合的內容</Typography>
              <Typography variant="body2" color="text.secondary">
                換個關鍵字，或切回「全部」再試一次。
              </Typography>
            </Stack>
          )}
        </DialogContent>
      </Dialog>

      <CustomSnackbar
        open={errorSnackOpen}
        severity="error"
        message="搜尋失敗，請稍後再試。"
        onClose={() => setErrorSnackOpen(false)}
      />
    </>
  );
}
