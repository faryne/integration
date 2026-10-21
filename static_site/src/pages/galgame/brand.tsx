import OpenInNewIcon from "@mui/icons-material/OpenInNew";
import {
  Avatar,
  Box,
  Button,
  Grid,
  Paper,
  Stack,
  Typography,
} from "@mui/material";
import axios from "axios";
import { useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";

import {
  useGalgameBrand,
  useGalgameBrandFavorite,
  useGalgameFavoriteStatus,
  useGalgameVideos,
} from "@/apis/galgame/catalog.ts";
import { ExpandableText } from "@/components/common/ExpandableText.tsx";
import { FavoriteButton } from "@/components/galgame/FavoriteButton.tsx";
import { GalgameBreadcrumb } from "@/components/galgame/GalgameBreadcrumb.tsx";
import { GalgamePagination } from "@/components/galgame/GalgamePagination.tsx";
import { GalgameState } from "@/components/galgame/GalgameState.tsx";
import { GalgameTimeFilterChips } from "@/components/galgame/GalgameTimeFilterChips.tsx";
import { GalgameVideoCard } from "@/components/galgame/GalgameVideoCard.tsx";
import { galgamePath } from "@/helpers/galgame.ts";
import {
  useGalgamePage,
  useGalgameTimeFilter,
} from "@/helpers/galgameTimeFilter.ts";
import { useTitle } from "@/helpers/title.tsx";
import { ErrorPage } from "@/pages/ErrorPage.tsx";

const perPage = 24;

/** 品牌頁：頁首（頭像、收錄數、最新上檔、介紹、連結、收藏）＋時間篩選＋影片列表 */
export default function GalgameBrand() {
  const { t, i18n } = useTranslation();
  const { brandSlug } = useParams();
  const { time, publishedAtFrom, setTime } = useGalgameTimeFilter();
  const { page } = useGalgamePage();
  const brandQuery = useGalgameBrand(brandSlug);
  const favorite = useGalgameBrandFavorite(brandSlug);
  const brand = brandQuery.data;
  const videos = useGalgameVideos(brandSlug, {
    page,
    per_page: perPage,
    published_at_from: publishedAtFrom,
  });
  // 頁首統計不受時間篩選影響：另抓 1 筆拿總收錄數與最新上檔日期（galgame.tv 自己的數字，不用 YouTube 頻道數據）
  const summary = useGalgameVideos(brandSlug, { page: 1, per_page: 1 });
  const latestVideo = summary.data?.data[0];
  const videoFavoriteStatus = useGalgameFavoriteStatus(
    [],
    videos.data?.data.map((video) => video.id) ?? [],
  );
  const favoriteVideoIDs = new Set(videoFavoriteStatus.data?.video_ids ?? []);
  useTitle(
    brand
      ? t("galgame.brand.pageTitle", { name: brand.name })
      : t("galgame.brand.pageTitleFallback"),
  );

  if (
    brandQuery.isError &&
    axios.isAxiosError(brandQuery.error) &&
    brandQuery.error.response?.status === 404
  ) {
    return <ErrorPage code={404} backUrl={galgamePath("brands")} />;
  }

  return (
    <Stack sx={{ pb: 6 }}>
      <GalgameBreadcrumb brand={brand} />
      {brandQuery.isPending ? (
        <GalgameState loading message={t("galgame.brand.loading")} />
      ) : brandQuery.isError || !brand ? (
        <GalgameState severity="error" message={t("galgame.brand.error")} />
      ) : (
        <>
          <Paper variant="outlined" sx={{ p: { xs: 2, md: 3 }, mb: 4 }}>
            <Stack
              direction={{ xs: "column", sm: "row" }}
              spacing={{ xs: 2, sm: 3 }}
              alignItems={{ xs: "center", sm: "flex-start" }}
            >
              <Avatar
                src={brand.avatar_url}
                alt={brand.name}
                sx={{ width: 112, height: 112, flexShrink: 0 }}
              />
              <Stack
                spacing={1.5}
                sx={{
                  minWidth: 0,
                  flex: 1,
                  alignItems: { xs: "center", sm: "flex-start" },
                  textAlign: { xs: "center", sm: "left" },
                }}
              >
                <Box>
                  <Typography variant="h4" component="h1" fontWeight={800}>
                    {brand.name}
                  </Typography>
                  {latestVideo && (
                    <Typography color="text.secondary" sx={{ mt: 0.5 }}>
                      {t("galgame.brand.stats", {
                        count: summary.data?.total ?? 0,
                        date: new Date(
                          latestVideo.published_at,
                        ).toLocaleDateString(i18n.language),
                      })}
                    </Typography>
                  )}
                </Box>
                {brand.description && (
                  <ExpandableText text={brand.description} collapsedLines={3} />
                )}
                <Stack
                  direction="row"
                  spacing={1}
                  useFlexGap
                  flexWrap="wrap"
                  justifyContent={{ xs: "center", sm: "flex-start" }}
                >
                  <FavoriteButton
                    kind="brand"
                    variant="button"
                    favorite={favorite.favorite}
                    loading={favorite.isFetching || favorite.mutation.isPending}
                    onToggle={(value) => favorite.mutation.mutateAsync(value)}
                  />
                  {brand.links.map((link) => (
                    <Button
                      key={link.url}
                      component="a"
                      href={link.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      variant="outlined"
                      endIcon={<OpenInNewIcon />}
                    >
                      {link.label}
                    </Button>
                  ))}
                </Stack>
              </Stack>
            </Stack>
          </Paper>

          <Stack
            direction={{ xs: "column", sm: "row" }}
            spacing={1.5}
            justifyContent="space-between"
            alignItems={{ xs: "flex-start", sm: "center" }}
            sx={{ mb: 2 }}
          >
            <Typography variant="h6" component="h2" fontWeight={700}>
              {t("galgame.brand.videosHeading")}
            </Typography>
            <GalgameTimeFilterChips value={time} onChange={setTime} />
          </Stack>
          {videos.isPending ? (
            <GalgameState loading message={t("galgame.brand.videosLoading")} />
          ) : videos.isError ? (
            <GalgameState
              severity="error"
              message={t("galgame.brand.videosError")}
            />
          ) : videos.data.data.length === 0 ? (
            <GalgameState
              message={
                time !== "all"
                  ? t("galgame.brand.videosEmptyInRange")
                  : t("galgame.brand.videosEmpty")
              }
            />
          ) : (
            <Grid container spacing={2.5}>
              {videos.data.data.map((video) => (
                <Grid
                  key={video.youtube_video_id}
                  size={{ xs: 12, sm: 6, md: 4, lg: 3 }}
                >
                  <GalgameVideoCard
                    video={video}
                    favorite={favoriteVideoIDs.has(video.id)}
                  />
                </Grid>
              ))}
            </Grid>
          )}
          <GalgamePagination
            total={videos.data?.total ?? 0}
            perPage={videos.data?.per_page || perPage}
          />
        </>
      )}
    </Stack>
  );
}
