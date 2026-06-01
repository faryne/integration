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
import { useNavigate, useSearchParams } from "react-router-dom";
import type { ListByPaginationRequest } from "@/apis/interfaces";
import type { Video } from "@/types/av.ts";
import MovieFilterIcon from "@mui/icons-material/MovieFilter";
import SearchOffIcon from "@mui/icons-material/SearchOff";

export function AVVideo() {
  const [search, setSearch] = useState<
    ListByPaginationRequest<VideoSearchRequest>
  >({
    page: 1,
  });
  const s = useAVVideoSearch(search);
  useTitle("AV 影片搜尋");

  const navigate = useNavigate();
  const [query] = useSearchParams();
  useEffect(() => {
    const keyword = query.get("keyword")?.trim();
    if (keyword) {
      setSearch({ page: 1, keyword });
    }
  }, [query]);

  const videos = s.data?.data?.data ?? [];
  const total = s.data?.data?.total ?? 0;
  const perPage = s.data?.data?.per_page ?? 0;
  const pageCount = perPage > 0 ? Math.ceil(total / perPage) : 0;
  const hasActiveFilter = Boolean(
    search.keyword || search.start_date || search.end_date,
  );

  const toVideoDetail = (video: Video) => {
    navigate(
      `/av/video/${video.maker_no && video.maker_no !== "" ? video.maker_no : video.no}`,
    );
  };

  const handleSearch = (input: VideoSearchRequest) => {
    setSearch({ ...input, page: 1 });
  };

  return (
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
                  {videos.map((video) => (
                    <Box
                      component="button"
                      key={video.maker_no ?? video.no}
                      onClick={() => toVideoDetail(video)}
                      sx={{
                        appearance: "none",
                        bgcolor: "background.paper",
                        border: "1px solid",
                        borderColor: "divider",
                        borderRadius: 2,
                        cursor: "pointer",
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
                        "&:hover": {
                          borderColor: "rgba(25, 118, 210, 0.42)",
                          boxShadow: "0 14px 34px rgba(15, 23, 42, 0.13)",
                          transform: "translateY(-2px)",
                        },
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
                          <Chip
                            label={video.maker_no ?? video.no}
                            size="small"
                            sx={{
                              borderRadius: 1,
                              fontSize: "0.72rem",
                              fontWeight: 700,
                            }}
                          />
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
                  ))}
                </Box>

                {pageCount > 1 && (
                  <Box
                    sx={{ display: "flex", justifyContent: "center", pt: 1 }}
                  >
                    <Pagination
                      count={pageCount}
                      onChange={(_, page) =>
                        setSearch((current) => ({ ...current, page }))
                      }
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
  );
}
