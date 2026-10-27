import {
  useAVVideoSearch,
  type VideoSearchRequest,
} from "@/apis/av/video_search";
import {
  Alert,
  Box,
  Chip,
  Grid,
  Pagination,
  Stack,
  Typography,
} from "@mui/material";
import { useTitle } from "@/helpers/title";
import { useEffect, useState } from "react";
import { VideoSearch } from "@/components/av/video_search";
import { AgeConfirmationGate } from "@/components/common/AgeConfirmation.tsx";
import { useSearchParams } from "react-router-dom";
import type { ListByPaginationRequest } from "@/apis/interfaces";
import {
  AV_VIDEO_EXACT_FILTERS,
  AV_VIDEO_TAG_LABEL,
  type AVVideoExactFilterParam,
} from "@/data/avVideoFilters.ts";
import {
  parseVideoSearchParams,
  videoSearchToParams,
} from "@/helpers/avVideoSearchParams.ts";
import { useAVVideoFacets } from "@/apis/av/video_facets.ts";
import {
  VideoFacetsPanel,
  type FacetParam,
} from "@/components/av/video_facets.tsx";
import MovieFilterIcon from "@mui/icons-material/MovieFilter";
import SearchOffIcon from "@mui/icons-material/SearchOff";
import {
  VideoResultCard,
  VideoResultSkeleton,
} from "@/components/av/video_result_card.tsx";
import { AV_VIDEO_GRID_COLUMNS } from "@/data/avVideoCover.ts";

export function AVVideo() {
  const [query, setQuery] = useSearchParams();
  const [search, setSearch] = useState<
    ListByPaginationRequest<VideoSearchRequest>
  >(() => parseVideoSearchParams(query));
  const s = useAVVideoSearch(search);
  // 篩選統計跟分頁無關：page 設成 undefined，查詢 key 會忽略它，換頁時沿用快取
  const facets = useAVVideoFacets({ ...search, page: undefined });
  useTitle("AV 影片搜尋");

  useEffect(() => {
    setSearch(parseVideoSearchParams(query));
  }, [query]);

  const videos = s.data?.data?.data ?? [];
  const total = s.data?.data?.total ?? 0;
  const perPage = s.data?.data?.per_page ?? 0;
  const pageCount = perPage > 0 ? Math.ceil(total / perPage) : 0;
  const activeExactFilters = AV_VIDEO_EXACT_FILTERS.filter(
    ({ param }) => search[param],
  );
  const activeTags = search.tag ?? [];
  const hasActiveFilter = Boolean(
    search.keyword ||
    search.start_date ||
    search.end_date ||
    activeTags.length > 0 ||
    activeExactFilters.length > 0,
  );

  const handleSearch = (input: VideoSearchRequest) => {
    setQuery(videoSearchToParams({ ...input, page: 1 }));
  };

  const handlePageChange = (page: number) => {
    setQuery(videoSearchToParams({ ...search, page }));
  };

  // 移除單一精確篩選條件，其餘條件保留並回到第一頁
  const removeExactFilter = (param: AVVideoExactFilterParam) => {
    setQuery(videoSearchToParams({ ...search, [param]: undefined, page: 1 }));
  };
  const removeTag = (tag: string) => {
    setQuery(
      videoSearchToParams({
        ...search,
        tag: activeTags.filter((t) => t !== tag),
        page: 1,
      }),
    );
  };

  // 篩選：標籤複選（加入／移除），其餘單選（再點一次取消）；一律回到第一頁
  const isFacetSelected = (param: FacetParam, value: string) =>
    param === "tag" ? activeTags.includes(value) : search[param] === value;
  const toggleFacet = (param: FacetParam, value: string) => {
    if (param === "tag") {
      const tag = activeTags.includes(value)
        ? activeTags.filter((t) => t !== value)
        : [...activeTags, value];
      setQuery(videoSearchToParams({ ...search, tag, page: 1 }));
      return;
    }
    const next = search[param] === value ? undefined : value;
    setQuery(videoSearchToParams({ ...search, [param]: next, page: 1 }));
  };

  return (
    <AgeConfirmationGate
      description="AV 影片搜尋頁包含成人內容與成人作品索引。請確認你已年滿 18 歲後再繼續瀏覽。"
      leaveTo="/"
      panelTitle="AV 影片搜尋需要年齡確認"
    >
      <Stack spacing={3}>
        <Box
          sx={{
            borderBottom: "1px solid",
            borderColor: "divider",
            pb: 2.5,
            textAlign: "left",
          }}
        >
          <Stack direction="row" spacing={1.5} sx={{ alignItems: "center" }}>
            <MovieFilterIcon color="primary" fontSize="large" />
            <Box>
              <Typography
                component="h1"
                sx={{
                  fontSize: { xs: "1.75rem", md: "2.25rem" },
                  fontWeight: 800,
                  letterSpacing: 0,
                  lineHeight: 1.2,
                }}
                variant="h3"
              >
                AV 影片搜尋
              </Typography>
              <Typography color="text.secondary" variant="body2">
                依關鍵字與發售日期篩選影片，點擊封面進入詳細頁。
              </Typography>
            </Box>
          </Stack>
        </Box>

        <Grid container spacing={3}>
          <Grid size={{ xs: 12, md: 4 }}>
            <Box
              sx={{
                border: "1px solid",
                borderColor: "divider",
                borderRadius: 2,
                p: 2.5,
                position: { md: "sticky" },
                textAlign: "left",
                top: { md: 24 },
              }}
            >
              <Typography fontWeight={800} sx={{ mb: 2 }} variant="h6">
                搜尋條件
              </Typography>
              <VideoSearch onClick={handleSearch} conditions={search} />
              {facets.data && (
                <Box
                  sx={{ borderTop: 1, borderColor: "divider", mt: 2.5, pt: 1 }}
                >
                  <VideoFacetsPanel
                    facets={facets.data}
                    isSelected={isFacetSelected}
                    onToggle={toggleFacet}
                  />
                </Box>
              )}
            </Box>
          </Grid>

          <Grid size={{ xs: 12, md: 8 }}>
            <Stack spacing={2.5}>
              <Box
                sx={{
                  alignItems: { xs: "flex-start", sm: "center" },
                  display: "flex",
                  flexDirection: { xs: "column", sm: "row" },
                  gap: 1.5,
                  justifyContent: "space-between",
                  textAlign: "left",
                }}
              >
                <Box>
                  <Typography fontWeight={800} variant="h6">
                    搜尋結果
                  </Typography>
                  <Typography color="text.secondary" variant="body2">
                    {s.isSuccess
                      ? `共 ${total.toLocaleString()} 筆資料`
                      : "讀取中"}
                  </Typography>
                </Box>
                {hasActiveFilter && (
                  <Stack direction="row" flexWrap="wrap" gap={1}>
                    {search.keyword && (
                      <Chip
                        label={`關鍵字：${search.keyword}`}
                        size="small"
                        sx={{ borderRadius: 1 }}
                      />
                    )}
                    {activeTags.map((tag) => (
                      <Chip
                        key={`tag-${tag}`}
                        label={`${AV_VIDEO_TAG_LABEL}：${tag}`}
                        onDelete={() => removeTag(tag)}
                        size="small"
                        sx={{ borderRadius: 1 }}
                      />
                    ))}
                    {activeExactFilters.map(({ param, label }) => (
                      <Chip
                        key={param}
                        label={`${label}：${search[param]}`}
                        onDelete={() => removeExactFilter(param)}
                        size="small"
                        sx={{ borderRadius: 1 }}
                      />
                    ))}
                    {search.start_date && (
                      <Chip
                        label={`開始：${search.start_date}`}
                        size="small"
                        sx={{ borderRadius: 1 }}
                        variant="outlined"
                      />
                    )}
                    {search.end_date && (
                      <Chip
                        label={`結束：${search.end_date}`}
                        size="small"
                        sx={{ borderRadius: 1 }}
                        variant="outlined"
                      />
                    )}
                  </Stack>
                )}
              </Box>

              {s.isError && (
                <Alert severity="error">搜尋資料讀取失敗，請稍後再試。</Alert>
              )}

              {(s.isLoading || s.isPending) && (
                <Box
                  sx={{
                    display: "grid",
                    gap: 2,
                    gridTemplateColumns: AV_VIDEO_GRID_COLUMNS,
                  }}
                >
                  {Array.from({ length: 6 }).map((_, index) => (
                    <VideoResultSkeleton key={index} />
                  ))}
                </Box>
              )}

              {!s.isLoading && s.isSuccess && videos.length === 0 && (
                <Box
                  sx={{
                    alignItems: "center",
                    border: "1px dashed",
                    borderColor: "divider",
                    borderRadius: 2,
                    color: "text.secondary",
                    display: "flex",
                    flexDirection: "column",
                    gap: 1,
                    minHeight: 260,
                    justifyContent: "center",
                    px: 3,
                    textAlign: "center",
                  }}
                >
                  <SearchOffIcon fontSize="large" />
                  <Typography fontWeight={800} variant="h6">
                    沒有符合條件的影片
                  </Typography>
                  <Typography variant="body2">
                    調整關鍵字或日期範圍後再搜尋。
                  </Typography>
                </Box>
              )}

              {!s.isLoading && s.isSuccess && videos.length > 0 && (
                <>
                  <Box
                    sx={{
                      display: "grid",
                      gap: 2,
                      gridTemplateColumns: AV_VIDEO_GRID_COLUMNS,
                    }}
                  >
                    {videos.map((video) => (
                      <VideoResultCard key={video.no} video={video} />
                    ))}
                  </Box>

                  {pageCount > 1 && (
                    <Box
                      sx={{ display: "flex", justifyContent: "center", pt: 1 }}
                    >
                      <Pagination
                        count={pageCount}
                        onChange={(_, page) => handlePageChange(page)}
                        page={search.page ?? 1}
                        shape="rounded"
                        variant="outlined"
                      />
                    </Box>
                  )}
                </>
              )}
            </Stack>
          </Grid>
        </Grid>
      </Stack>
    </AgeConfirmationGate>
  );
}
