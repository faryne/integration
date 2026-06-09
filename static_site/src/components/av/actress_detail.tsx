import type { Actress, Video } from "@/types/av.ts";
import {
  Box,
  Card,
  CardContent,
  Chip,
  Grid,
  Pagination,
  Skeleton,
  Stack,
  Typography,
} from "@mui/material";
import type { UseQueryResult } from "@tanstack/react-query";
import type { VideoSearchResponse } from "@/apis/av/video_search.ts";
import { useNavigate } from "react-router-dom";
import SearchOffIcon from "@mui/icons-material/SearchOff";

const videoDetailId = (video: Video) =>
  video.maker_no?.trim() || video.no?.trim() || undefined;

const videoDisplayMakerNo = (video: Video) =>
  video.maker_no?.trim() || undefined;

const uniqueNonEmpty = (items: string[]) =>
  Array.from(new Set(items.map((item) => item.trim()).filter(Boolean)));

type TagStat = {
  count: number;
  name: string;
};

const videoTagStats = (videos: Video[]): TagStat[] => {
  const counter = new Map<string, number>();
  videos.forEach((video) => {
    uniqueNonEmpty(video.tags).forEach((tag) => {
      counter.set(tag, (counter.get(tag) ?? 0) + 1);
    });
  });
  return Array.from(counter.entries())
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
};

const topTagSx = (index: number) => {
  switch (index) {
    case 0:
      return {
        bgcolor: "rgba(245, 158, 11, 0.16)",
        borderColor: "rgba(245, 158, 11, 0.62)",
        color: "#92400e",
      };
    case 1:
      return {
        bgcolor: "rgba(37, 99, 235, 0.12)",
        borderColor: "rgba(37, 99, 235, 0.48)",
        color: "#1d4ed8",
      };
    case 2:
      return {
        bgcolor: "rgba(22, 163, 74, 0.12)",
        borderColor: "rgba(22, 163, 74, 0.48)",
        color: "#15803d",
      };
    default:
      return {};
  }
};

export interface IActressDetail {
  actress?: Actress;
  onVideoPageChange?: (page: number) => void;
  videoPage?: number;
  videos?: UseQueryResult<VideoSearchResponse, Error>;
}

export function ActressDetail(props: IActressDetail) {
  const actress = props.actress ?? null;
  const navigate = useNavigate();
  const videos = props.videos?.data?.data?.data ?? [];
  const total = props.videos?.data?.data?.total ?? 0;
  const perPage = props.videos?.data?.data?.per_page ?? 0;
  const pageCount = perPage > 0 ? Math.ceil(total / perPage) : 0;
  const currentPage =
    props.videos?.data?.data?.current_page ?? props.videoPage ?? 1;
  const relatedMakers = uniqueNonEmpty(videos.flatMap((video) => video.makers));
  const relatedTags = videoTagStats(videos);

  const toVideoDetail = (video: (typeof videos)[number]) => {
    const id = videoDetailId(video);
    if (!id) {
      return;
    }

    navigate(`/av/video/${id}`);
  };

  const toVideoSearch = (keyword: string) => {
    navigate(`/av/video?keyword=${encodeURIComponent(keyword)}`);
  };

  const renderRelatedChips = (items: string[], keyPrefix: string) =>
    items.length > 0 ? (
      items.slice(0, 24).map((item) => (
        <Chip
          clickable
          key={`${keyPrefix}-${item}`}
          label={item}
          onClick={() => toVideoSearch(item)}
          size="small"
          sx={{
            borderRadius: 1.25,
            fontWeight: 700,
            maxWidth: "100%",
          }}
          variant="outlined"
        />
      ))
    ) : (
      <Typography color="text.secondary" variant="body2">
        目前載入的出演影片沒有相關資料
      </Typography>
    );

  const renderTagChips = (items: TagStat[]) =>
    items.length > 0 ? (
      items.slice(0, 24).map((item, index) => (
        <Chip
          clickable
          key={`tag-${item.name}`}
          label={`${item.name} ${item.count}`}
          onClick={() => toVideoSearch(item.name)}
          size="small"
          sx={{
            borderRadius: 1.25,
            fontWeight: index < 3 ? 900 : 700,
            maxWidth: "100%",
            ...topTagSx(index),
          }}
          variant="outlined"
        />
      ))
    ) : (
      <Typography color="text.secondary" variant="body2">
        目前載入的出演影片沒有相關資料
      </Typography>
    );

  const renderSidebar = () => {
    if (!actress) {
      return null;
    }

    return (
      <Stack spacing={2}>
        <Card>
          <CardContent>
            <Stack alignItems="center" direction="column" spacing={2}>
              <Box
                component="img"
                src={actress.photo}
                alt={actress.name}
                title={actress.name}
                sx={{
                  borderRadius: 2,
                  display: "block",
                  maxWidth: "100%",
                  width: 200,
                }}
              />
              <Box sx={{ textAlign: "center", width: "100%" }}>
                <Typography fontWeight={900} variant="h6">
                  {actress.name}
                </Typography>
                {actress.kana && (
                  <Typography color="text.secondary" variant="body2">
                    {actress.kana}
                  </Typography>
                )}
              </Box>
              <Stack spacing={1} sx={{ textAlign: "left", width: "100%" }}>
                <Typography variant="body1">
                  三圍：
                  {actress.bust +
                    (actress.cup ?? "") +
                    " / " +
                    actress.waist +
                    " / " +
                    actress.hips}
                </Typography>
                <Typography variant="body1">
                  生日：
                  {actress.birth_year +
                    "/" +
                    actress.birth_month +
                    "/" +
                    actress.birth_day}
                </Typography>
                {actress.height > 0 && (
                  <Typography variant="body1">
                    身高：{actress.height + " cm"}
                  </Typography>
                )}
              </Stack>
            </Stack>
          </CardContent>
        </Card>
        <Card>
          <CardContent>
            <Stack spacing={1.25}>
              <Typography fontWeight={900}>發售商</Typography>
              <Stack direction="row" flexWrap="wrap" gap={1}>
                {renderRelatedChips(relatedMakers, "maker")}
              </Stack>
            </Stack>
          </CardContent>
        </Card>
        <Card>
          <CardContent>
            <Stack spacing={1.25}>
              <Typography fontWeight={900}>影片標籤</Typography>
              <Stack direction="row" flexWrap="wrap" gap={1}>
                {renderTagChips(relatedTags)}
              </Stack>
            </Stack>
          </CardContent>
        </Card>
      </Stack>
    );
  };

  if (!actress) {
    return null;
  }

  return (
    <Grid container spacing={3}>
      <Grid size={{ xs: 12, md: 4 }}>{renderSidebar()}</Grid>
      <Grid size={{ xs: 12, md: 8 }}>
        <Stack spacing={2.5}>
          <Box sx={{ textAlign: "left" }}>
            <Typography fontWeight={800} variant="h6">
              出演影片
            </Typography>
            <Typography color="text.secondary" variant="body2">
              {props.videos?.isSuccess
                ? `共 ${total.toLocaleString()} 筆資料`
                : "讀取中"}
            </Typography>
          </Box>

          {(props.videos?.isLoading || props.videos?.isPending) && (
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

          {!props.videos?.isLoading &&
            props.videos?.isSuccess &&
            videos.length === 0 && (
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
                  justifyContent: "center",
                  minHeight: 260,
                  px: 3,
                  textAlign: "center",
                }}
              >
                <SearchOffIcon fontSize="large" />
                <Typography fontWeight={800} variant="h6">
                  沒有出演影片
                </Typography>
                <Typography variant="body2">
                  目前沒有找到這位女優的出演影片資料。
                </Typography>
              </Box>
            )}

          {!props.videos?.isLoading &&
            props.videos?.isSuccess &&
            videos.length > 0 && (
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
                                boxShadow: "0 14px 34px rgba(15, 23, 42, 0.13)",
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
                    sx={{
                      display: "flex",
                      justifyContent: "center",
                      pt: 1,
                    }}
                  >
                    <Pagination
                      count={pageCount}
                      onChange={(_, page) => props.onVideoPageChange?.(page)}
                      page={currentPage}
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
  );
}
