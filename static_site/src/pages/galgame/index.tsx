import { Box, Grid, Link, Stack, Typography } from "@mui/material";
import { useTranslation } from "react-i18next";
import {
  Navigate,
  Link as RouterLink,
  useSearchParams,
} from "react-router-dom";

import {
  useGalgameBrands,
  useGalgameFavoriteStatus,
  useGalgameVideos,
} from "@/apis/galgame/catalog.ts";
import { BrandStrip } from "@/components/galgame/BrandStrip.tsx";
import { GalgamePageHeader } from "@/components/galgame/GalgamePageHeader.tsx";
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

// 首頁品牌橫列只列出 N 天內有上新片的品牌；沒有就整區隱藏
const recentBrandDays = 7;
const perPage = 24;

/** 首頁：近期有新片的品牌＋最新影片；帶 ?keyword= 時改為搜尋結果（符合的品牌＋影片） */
export default function GalgameHome() {
  const { t } = useTranslation();
  const [params] = useSearchParams();
  const keyword = (params.get("keyword") ?? "").trim();
  const { time, publishedAtFrom, setTime } = useGalgameTimeFilter();
  const { page } = useGalgamePage();
  const videos = useGalgameVideos(undefined, {
    keyword: keyword || undefined,
    page,
    per_page: perPage,
    published_at_from: publishedAtFrom,
  });
  // 搜尋時列出符合的品牌（只取前 8 筆、不分頁），否則列出近期有新片的品牌
  const brands = useGalgameBrands(
    keyword,
    1,
    keyword ? 8 : 12,
    keyword ? 0 : recentBrandDays,
  );
  const favoriteStatus = useGalgameFavoriteStatus(
    [],
    videos.data?.data.map((video) => video.id) ?? [],
  );
  const favoriteVideoIDs = new Set(favoriteStatus.data?.video_ids ?? []);
  useTitle(
    keyword
      ? t("galgame.home.searchPageTitle", { keyword })
      : t("galgame.home.pageTitle"),
  );

  // 舊網址 ?tab=brands 改由獨立的品牌頁處理
  if (params.get("tab") === "brands") {
    return <Navigate to={galgamePath("brands")} replace />;
  }

  return (
    <Box sx={{ pb: 6 }}>
      <GalgamePageHeader
        current={
          keyword ? t("galgame.home.searchCrumb", { keyword }) : undefined
        }
        title={
          keyword ? t("galgame.home.searchHeading", { keyword }) : undefined
        }
      />

      {(brands.data?.data.length ?? 0) > 0 && (
        <Box component="section" sx={{ mb: 4 }}>
          <Stack
            direction="row"
            justifyContent="space-between"
            alignItems="baseline"
            sx={{ mb: 1.5 }}
          >
            <Typography variant="h6" component="h2" fontWeight={700}>
              {keyword
                ? t("galgame.home.matchedBrands", {
                    count: brands.data?.total ?? 0,
                  })
                : t("galgame.home.recentBrands")}
            </Typography>
            {!keyword && (
              <Link
                component={RouterLink}
                to={galgamePath("brands")}
                underline="hover"
                fontWeight={600}
              >
                {t("galgame.home.allBrands")}
              </Link>
            )}
          </Stack>
          <BrandStrip
            brands={brands.data?.data ?? []}
            caption={
              keyword
                ? undefined
                : (brand) =>
                    t("galgame.home.recentBrandCaption", {
                      count: brand.latest_video_count,
                    })
            }
          />
        </Box>
      )}

      <Stack component="section">
        <Stack
          direction={{ xs: "column", sm: "row" }}
          spacing={1.5}
          justifyContent="space-between"
          alignItems={{ xs: "flex-start", sm: "center" }}
          sx={{ mb: 2 }}
        >
          <Typography variant="h6" component="h2" fontWeight={700}>
            {keyword
              ? t("galgame.home.matchedVideos", {
                  count: videos.data?.total ?? 0,
                })
              : t("galgame.home.latestVideos")}
          </Typography>
          <GalgameTimeFilterChips value={time} onChange={setTime} />
        </Stack>
        {videos.isPending ? (
          <GalgameState loading message={t("galgame.home.videos.loading")} />
        ) : videos.isError ? (
          <GalgameState
            severity="error"
            message={t("galgame.home.videos.error")}
          />
        ) : videos.data.data.length === 0 ? (
          <GalgameState
            message={
              keyword
                ? t("galgame.home.videos.notFound")
                : time !== "all"
                  ? t("galgame.home.videos.emptyInRange")
                  : t("galgame.home.videos.empty")
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
      </Stack>
    </Box>
  );
}
