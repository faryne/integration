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
  Skeleton,
  Stack,
  Typography,
} from "@mui/material";
import { useTitle } from "@/helpers/title";
import { useEffect, useState } from "react";
import { VideoSearch } from "@/components/av/video_search";
import { AgeConfirmationGate } from "@/components/common/AgeConfirmation.tsx";
import { useNavigate, useSearchParams } from "react-router-dom";
import type { ListByPaginationRequest } from "@/apis/interfaces";
import type { Video } from "@/types/av.ts";
import MovieFilterIcon from "@mui/icons-material/MovieFilter";
import SearchOffIcon from "@mui/icons-material/SearchOff";

const videoDetailId = (video: Video) =>
  video.maker_no?.trim() || video.no?.trim() || undefined;

const videoDisplayMakerNo = (video: Video) =>
  video.maker_no?.trim() || undefined;

const parsePositiveInt = (value: string | null) => {
  if (!value) {
    return undefined;
  }

  const parsed = parseInt(value, 10);
  return Number.isNaN(parsed) || parsed <= 0 ? undefined : parsed;
};

const parseVideoSearchParams = (
  query: URLSearchParams,
): ListByPaginationRequest<VideoSearchRequest> => {
  const page = parsePositiveInt(query.get("page")) ?? 1;
  const search: ListByPaginationRequest<VideoSearchRequest> = { page };
  const keyword = query.get("keyword")?.trim();
  const startDate = query.get("start_date")?.trim();
  const endDate = query.get("end_date")?.trim();

  if (keyword) {
    search.keyword = keyword;
  }
  if (startDate) {
    search.start_date = startDate;
  }
  if (endDate) {
    search.end_date = endDate;
  }

  return search;
};

const videoSearchToParams = (
  search: ListByPaginationRequest<VideoSearchRequest>,
) => {
  const query = new URLSearchParams();
  const page = search.page ?? 1;

  if (page > 1) {
    query.set("page", String(page));
  }
  if (search.keyword?.trim()) {
    query.set("keyword", search.keyword.trim());
  }
  if (search.start_date) {
    query.set("start_date", search.start_date);
  }
  if (search.end_date) {
    query.set("end_date", search.end_date);
  }

  return query;
};

export function AVVideo() {
  const [query, setQuery] = useSearchParams();
  const [search, setSearch] = useState<
    ListByPaginationRequest<VideoSearchRequest>
  >(() => parseVideoSearchParams(query));
  const s = useAVVideoSearch(search);
  useTitle("AV 影片搜尋");

  const navigate = useNavigate();

  useEffect(() => {
    setSearch(parseVideoSearchParams(query));
  }, [query]);

  const videos = s.data?.data?.data ?? [];
  const total = s.data?.data?.total ?? 0;
  const perPage = s.data?.data?.per_page ?? 0;
  const pageCount = perPage > 0 ? Math.ceil(total / perPage) : 0;
  const hasActiveFilter = Boolean(
    search.keyword || search.start_date || search.end_date,
  );

  const toVideoDetail = (video: Video) => {
    const id = videoDetailId(video);
    if (!id) {
      return;
    }

    navigate(`/av/video/${id}`);
  };

  const handleSearch = (input: VideoSearchRequest) => {
    setQuery(videoSearchToParams({ ...input, page: 1 }));
  };

  const handlePageChange = (page: number) => {
    setQuery(videoSearchToParams({ ...search, page }));
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
                    gridTemplateColumns: {
                      xs: "1fr",
                      sm: "repeat(2, minmax(0, 1fr))",
                      lg: "repeat(3, minmax(0, 1fr))",
                    },
                  }}
                >
                  {Array.from({ length: 6 }).map((_, index) => (
                    <Stack key={index} spacing={1}>
                      <Skeleton
                        height={180}
                        sx={{ borderRadius: 2 }}
                        variant="rounded"
                      />
                      <Skeleton height={28} variant="rounded" />
                      <Skeleton height={22} width="70%" variant="rounded" />
                    </Stack>
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
                      gridTemplateColumns: {
                        xs: "1fr",
                        sm: "repeat(2, minmax(0, 1fr))",
                        lg: "repeat(3, minmax(0, 1fr))",
                      },
                    }}
                  >
                    {videos.map((video) => {
                      const detailId = videoDetailId(video);
                      const displayMakerNo = videoDisplayMakerNo(video);

                      return (
                        <Box
                          component="button"
                          disabled={!detailId}
                          key={detailId ?? video.url ?? video.title}
                          onClick={() => toVideoDetail(video)}
                          sx={{
                            appearance: "none",
                            bgcolor: "background.paper",
                            border: "1px solid",
                            borderColor: "divider",
                            borderRadius: 2,
                            cursor: detailId ? "pointer" : "default",
                            display: "flex",
                            flexDirection: "column",
                            overflow: "hidden",
                            p: 0,
                            textAlign: "left",
                            transition:
                              "transform 160ms ease, box-shadow 160ms ease, border-color 160ms ease",
                            width: "100%",
                            "&:focus-visible": {
                              borderColor: "primary.main",
                              boxShadow: "0 0 0 3px rgba(25, 118, 210, 0.28)",
                              outline: 0,
                            },
                            "&:hover": detailId
                              ? {
                                  borderColor: "rgba(25, 118, 210, 0.42)",
                                  boxShadow:
                                    "0 14px 34px rgba(15, 23, 42, 0.13)",
                                  transform: "translateY(-2px)",
                                }
                              : undefined,
                          }}
                        >
                          <Box
                            sx={{
                              aspectRatio: "16 / 10",
                              bgcolor: "grey.100",
                              overflow: "hidden",
                              width: "100%",
                            }}
                          >
                            <Box
                              component="img"
                              src={video.thumb}
                              alt={video.title}
                              loading="lazy"
                              sx={{
                                display: "block",
                                height: "100%",
                                objectFit: "cover",
                                width: "100%",
                              }}
                            />
                          </Box>
                          <Stack spacing={1} sx={{ p: 1.5 }}>
                            <Stack direction="row" flexWrap="wrap" gap={0.75}>
                              {displayMakerNo && (
                                <Chip
                                  label={displayMakerNo}
                                  size="small"
                                  sx={{
                                    borderRadius: 1,
                                    fontSize: "0.72rem",
                                    fontWeight: 700,
                                  }}
                                />
                              )}
                              {video.vod_date && (
                                <Chip
                                  label={video.vod_date}
                                  size="small"
                                  sx={{
                                    borderRadius: 1,
                                    fontSize: "0.72rem",
                                  }}
                                  variant="outlined"
                                />
                              )}
                            </Stack>
                            <Typography
                              sx={{
                                color: "text.primary",
                                display: "-webkit-box",
                                fontWeight: 800,
                                letterSpacing: 0,
                                lineHeight: 1.35,
                                minHeight: "2.7em",
                                overflow: "hidden",
                                WebkitBoxOrient: "vertical",
                                WebkitLineClamp: 2,
                              }}
                              variant="body1"
                            >
                              {video.title}
                            </Typography>
                            <Typography
                              color="text.secondary"
                              sx={{
                                minHeight: "1.43em",
                                overflow: "hidden",
                                textOverflow: "ellipsis",
                                whiteSpace: "nowrap",
                              }}
                              variant="body2"
                            >
                              {video.actresses
                                .filter((a) => a !== "")
                                .join(" / ") || "未登錄出演資訊"}
                            </Typography>
                          </Stack>
                        </Box>
                      );
                    })}
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
