import {
  Avatar,
  Box,
  Card,
  CardActionArea,
  CardContent,
  Grid,
  Pagination,
  Stack,
  Tab,
  Tabs,
  Typography,
} from "@mui/material";
import StarIcon from "@mui/icons-material/Star";
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link as RouterLink, useSearchParams } from "react-router-dom";

import {
  useGalgameBrands,
  useGalgameFavoriteStatus,
  useGalgameVideos,
} from "@/apis/galgame/catalog.ts";
import { GalgameBreadcrumb } from "@/components/galgame/GalgameBreadcrumb.tsx";
import { GalgameVideoCard } from "@/components/galgame/GalgameVideoCard.tsx";
import { GalgameState } from "@/components/galgame/GalgameState.tsx";
import { useTitle } from "@/helpers/title.tsx";
import { galgameBrandSlug, galgamePath } from "@/helpers/galgame.ts";

export default function GalgameHome() {
  const { t } = useTranslation();
  const [params, setParams] = useSearchParams();
  const keyword = params.get("keyword") ?? "";
  const tab =
    params.get("tab") === "recent"
      ? "recent"
      : params.get("tab") === "brands"
        ? "brands"
        : "all";
  const page = Math.max(1, Number(params.get("page")) || 1);
  const [recentFrom] = useState(() =>
    new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
  );
  const publishedAtFrom = tab === "recent" ? recentFrom : undefined;
  const videos = useGalgameVideos(
    undefined,
    { keyword, page, per_page: 24, published_at_from: publishedAtFrom },
    tab !== "brands",
  );
  const brands = useGalgameBrands(keyword, page, 24);
  const favoriteStatus = useGalgameFavoriteStatus(
    brands.data?.data.map((brand) => brand.id) ?? [],
    videos.data?.data.map((video) => video.id) ?? [],
  );
  const favoriteBrandIDs = new Set(favoriteStatus.data?.brand_ids ?? []);
  const favoriteVideoIDs = new Set(favoriteStatus.data?.video_ids ?? []);
  useTitle(t("galgame.home.pageTitle"));

  const pages = useMemo(() => {
    const result = tab === "brands" ? brands.data : videos.data;
    return Math.max(
      1,
      Math.ceil((result?.total ?? 0) / (result?.per_page || 24)),
    );
  }, [brands.data, tab, videos.data]);
  return (
    <Box sx={{ pb: 6 }}>
      <GalgameBreadcrumb />
      <Stack spacing={3}>
        <Stack
          direction={{ xs: "column", sm: "row" }}
          spacing={2}
          justifyContent="space-between"
          alignItems={{ xs: "flex-start", sm: "center" }}
        >
          <Box>
            <Typography variant="h3" component="h1">
              {t("galgame.home.heading")}
            </Typography>
            <Typography color="text.secondary">
              {t("galgame.home.subtitle")}
            </Typography>
          </Box>
        </Stack>
        <Tabs
          value={tab}
          onChange={(_, value: "all" | "recent" | "brands") => {
            const next = new URLSearchParams(params);
            if (value === "all") {
              next.delete("tab");
            } else {
              next.set("tab", value);
            }
            next.delete("page");
            next.delete("keyword");
            setParams(next);
          }}
          aria-label={t("galgame.home.tabs.ariaLabel")}
          // 手機寬度（尤其外語）三個分頁放不下，改成可橫向捲動
          variant="scrollable"
          allowScrollButtonsMobile
        >
          <Tab value="all" label={t("galgame.home.tabs.all")} />
          <Tab value="recent" label={t("galgame.home.tabs.recent")} />
          <Tab value="brands" label={t("galgame.home.tabs.brands")} />
        </Tabs>
        {tab === "brands" ? (
          brands.isPending ? (
            <GalgameState loading message={t("galgame.home.brands.loading")} />
          ) : brands.isError ? (
            <GalgameState
              severity="error"
              message={t("galgame.home.brands.error")}
            />
          ) : brands.data.data.length === 0 ? (
            <GalgameState
              message={
                keyword
                  ? t("galgame.home.brands.notFound")
                  : t("galgame.home.brands.empty")
              }
            />
          ) : (
            <Grid container spacing={3}>
              {brands.data.data.map((brand) => (
                <Grid key={brand.public_id} size={{ xs: 12, sm: 6, md: 3 }}>
                  <Card sx={{ height: "100%" }}>
                    <CardActionArea
                      component={RouterLink}
                      to={galgamePath(
                        galgameBrandSlug(brand.public_id, brand.name),
                      )}
                      sx={{ height: "100%" }}
                    >
                      <CardContent>
                        <Stack alignItems="center" spacing={2}>
                          <Avatar
                            src={brand.avatar_url}
                            alt={brand.name}
                            sx={{ width: 112, height: 112 }}
                          />
                          <Stack
                            direction="row"
                            alignItems="center"
                            spacing={0.5}
                          >
                            <Typography variant="h6" textAlign="center">
                              {brand.name}
                            </Typography>
                            {favoriteBrandIDs.has(brand.id) && (
                              <StarIcon
                                color="warning"
                                fontSize="small"
                                aria-label={t("galgame.home.brands.favorited")}
                              />
                            )}
                          </Stack>
                        </Stack>
                      </CardContent>
                    </CardActionArea>
                  </Card>
                </Grid>
              ))}
            </Grid>
          )
        ) : videos.isPending ? (
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
                : t("galgame.home.videos.empty")
            }
          />
        ) : (
          <>
            <Grid container spacing={3}>
              {videos.data.data.map((video) => (
                <Grid
                  key={video.youtube_video_id}
                  size={{ xs: 12, sm: 6, md: 4 }}
                >
                  <GalgameVideoCard
                    video={video}
                    favorite={favoriteVideoIDs.has(video.id)}
                  />
                </Grid>
              ))}
            </Grid>
          </>
        )}
        {((tab === "brands" && (brands.data?.total ?? 0) > 0) ||
          (tab !== "brands" && (videos.data?.total ?? 0) > 0)) && (
          <Pagination
            page={page}
            count={pages}
            onChange={(_, value) => {
              const next = new URLSearchParams(params);
              if (value === 1) {
                next.delete("page");
              } else {
                next.set("page", String(value));
              }
              setParams(next);
            }}
            sx={{ alignSelf: "center" }}
          />
        )}
      </Stack>
    </Box>
  );
}
