import type { Actress, Video } from "@/types/av.ts";
import {
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Grid,
  Pagination,
  Stack,
  Tab,
  Tabs,
  Typography,
} from "@mui/material";
import type { UseQueryResult } from "@tanstack/react-query";
import type { VideoSearchResponse } from "@/apis/av/video_search.ts";
import { Link as RouterLink, useNavigate } from "react-router-dom";
import EditOutlinedIcon from "@mui/icons-material/EditOutlined";
import { ActressLinksCard } from "@/components/av/actress_links_card.tsx";
import { ActressNames } from "@/components/av/actress_names.tsx";
import { ActressTopicChip } from "@/components/av/actress_topic_chip.tsx";
import { ActressPhoto } from "@/components/av/actress_photo.tsx";
import { ActressSameNames } from "@/components/av/actress_same_names.tsx";
import { actressPagePath } from "@/helpers/avActressRef.ts";
import {
  formatActressBirth,
  formatActressMeasurements,
} from "@/helpers/avActressDisplay.ts";
import SearchOffIcon from "@mui/icons-material/SearchOff";
import {
  VideoResultCard,
  VideoResultSkeleton,
} from "@/components/av/video_result_card.tsx";
import { AV_VIDEO_GRID_COLUMNS } from "@/data/avVideoCover.ts";

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

export /** 出演影片的 tab：topic＝從有類型條件的主題點進來時的「該主題作品」、all＝全部作品 */
type ActressVideoTab = "topic" | "all";

interface IActressDetail {
  actress?: Actress;
  // 網址上的名字：本名或其中一個別名，出演影片只列這個名義的作品
  pageName?: string;
  onVideoPageChange?: (page: number) => void;
  // 名字完全相同的所有人（含這位），兩位以上時顯示「可能同名的女優」切換
  sameNames?: Actress[];
  videoPage?: number;
  videos?: UseQueryResult<VideoSearchResponse, Error>;
  // 從有類型條件的主題點進來才有：label 是主題名稱，value／onChange 控制目前的 tab
  videoTabs?: {
    label: string;
    value: ActressVideoTab;
    onChange: (tab: ActressVideoTab) => void;
  };
}

export function ActressDetail(props: IActressDetail) {
  const actress = props.actress ?? null;
  const pageName = props.pageName || actress?.name || "";
  const navigate = useNavigate();
  const videos = props.videos?.data?.data?.data ?? [];
  const total = props.videos?.data?.data?.total ?? 0;
  const perPage = props.videos?.data?.data?.per_page ?? 0;
  const pageCount = perPage > 0 ? Math.ceil(total / perPage) : 0;
  const currentPage =
    props.videos?.data?.data?.current_page ?? props.videoPage ?? 1;
  const relatedMakers = uniqueNonEmpty(videos.flatMap((video) => video.makers));
  const relatedTags = videoTagStats(videos);

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

    const measurements = formatActressMeasurements(actress);
    const birth = formatActressBirth(actress);
    return (
      <Stack spacing={2}>
        <ActressSameNames actresses={props.sameNames ?? []} current={actress} />
        <Card>
          <CardContent>
            <Stack alignItems="center" direction="column" spacing={2}>
              <ActressPhoto
                alt={actress.name}
                src={actress.photo}
                sx={{ borderRadius: 2, maxWidth: "100%", width: 200 }}
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
              <ActressNames actress={actress} current={pageName} />
              <ActressTopicChip />
              <Stack spacing={1} sx={{ textAlign: "left", width: "100%" }}>
                {/* 手動上稿的女優常常只有部分資料，沒填的整行不顯示 */}
                {measurements && (
                  <Typography variant="body1">三圍：{measurements}</Typography>
                )}
                {birth && (
                  <Typography variant="body1">生日：{birth}</Typography>
                )}
                {actress.height > 0 && (
                  <Typography variant="body1">
                    身高：{actress.height + " cm"}
                  </Typography>
                )}
              </Stack>
              {/* 資料有誤或缺漏時送修改單，管理者核准後才更新 */}
              <Button
                component={RouterLink}
                size="small"
                startIcon={<EditOutlinedIcon />}
                to={actressPagePath(actress.name, actress, "/edit")}
                variant="outlined"
              >
                修改資料
              </Button>
            </Stack>
          </CardContent>
        </Card>
        <ActressLinksCard links={actress.links} />
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
                ? `${pageName !== actress.name ? `${pageName} 名義・` : ""}共 ${total.toLocaleString()} 筆資料`
                : "讀取中"}
            </Typography>
          </Box>

          {props.videoTabs && (
            <Tabs
              onChange={(_, v: ActressVideoTab) => props.videoTabs?.onChange(v)}
              sx={{ borderBottom: 1, borderColor: "divider" }}
              value={props.videoTabs.value}
            >
              <Tab label={`${props.videoTabs.label}作品`} value="topic" />
              <Tab label="全部作品" value="all" />
            </Tabs>
          )}

          {(props.videos?.isLoading || props.videos?.isPending) && (
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
                    gridTemplateColumns: AV_VIDEO_GRID_COLUMNS,
                  }}
                >
                  {videos.map((video) => (
                    <VideoResultCard key={video.no} video={video} />
                  ))}
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
