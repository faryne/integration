import {
  Avatar,
  Box,
  Button,
  Card,
  CardActionArea,
  CardContent,
  Chip,
  Grid,
  Pagination,
  Stack,
  Tab,
  Tabs,
  Typography,
} from "@mui/material";
import StarIcon from "@mui/icons-material/Star";
import { useMemo } from "react";
import { Link as RouterLink, useSearchParams } from "react-router-dom";
import { useTranslation } from "react-i18next";

import {
  useFavoriteGalgameBrands,
  useFavoriteGalgameVideos,
} from "@/apis/galgame/catalog.ts";
import { useAuth } from "@/components/auth/AuthContext.ts";
import { GalgamePageHeader } from "@/components/galgame/GalgamePageHeader.tsx";
import { GalgameState } from "@/components/galgame/GalgameState.tsx";
import { GalgameVideoCard } from "@/components/galgame/GalgameVideoCard.tsx";
import { galgameBrandSlug, galgamePath } from "@/helpers/galgame.ts";
import { useTitle } from "@/helpers/title.tsx";

export default function GalgameFavorites() {
  const { t } = useTranslation();
  const { session, loading, login, submitting } = useAuth();
  const [params, setParams] = useSearchParams();
  const tab = params.get("tab") === "brands" ? "brands" : "videos";
  const page = Math.max(1, Number(params.get("page")) || 1);
  const brands = useFavoriteGalgameBrands("", page, 24);
  const videos = useFavoriteGalgameVideos("", page, 24);
  const result = tab === "brands" ? brands : videos;
  const pages = useMemo(
    () =>
      Math.max(
        1,
        Math.ceil((result.data?.total ?? 0) / (result.data?.per_page || 24)),
      ),
    [result.data],
  );
  useTitle(t("galgame.favorites.pageTitle"));

  if (loading) {
    return <GalgameState loading message={t("galgame.authGate.checking")} />;
  }

  if (!session) {
    return (
      <Stack spacing={2} alignItems="flex-start">
        <GalgamePageHeader current={t("galgame.favorites.heading")} />
        <GalgameState message={t("galgame.favorites.loginPrompt")} />
        <Button
          variant="contained"
          onClick={() => void login()}
          disabled={submitting}
        >
          {submitting
            ? t("galgame.favorites.loggingIn")
            : t("galgame.favorites.login")}
        </Button>
      </Stack>
    );
  }

  return (
    <Box sx={{ pb: 6 }}>
      <GalgamePageHeader
        current={t("galgame.favorites.heading")}
        title={t("galgame.favorites.heading")}
      />
      <Stack spacing={3}>
        <Tabs
          value={tab}
          onChange={(_, value: "videos" | "brands") =>
            setParams(value === "brands" ? { tab: "brands" } : {})
          }
        >
          <Tab value="videos" label={t("galgame.favorites.tabs.videos")} />
          <Tab value="brands" label={t("galgame.favorites.tabs.brands")} />
        </Tabs>

        {result.isPending ? (
          <GalgameState loading message={t("galgame.favorites.loading")} />
        ) : result.isError ? (
          <GalgameState
            severity="error"
            message={t("galgame.favorites.error")}
          />
        ) : tab === "brands" ? (
          brands.data!.data.length === 0 ? (
            <GalgameState message={t("galgame.favorites.brandsEmpty")} />
          ) : (
            <Grid container spacing={3}>
              {brands.data!.data.map((brand) => (
                <Grid key={brand.id} size={{ xs: 12, sm: 6, md: 3 }}>
                  <Card
                    sx={{
                      height: "100%",
                      opacity: brand.deleted_at ? 0.58 : 1,
                    }}
                  >
                    <CardActionArea
                      component={
                        brand.latest_video_count > 0 && !brand.deleted_at
                          ? RouterLink
                          : "button"
                      }
                      to={
                        brand.latest_video_count > 0 && !brand.deleted_at
                          ? `${galgamePath(galgameBrandSlug(brand.public_id, brand.name))}?time=7d`
                          : undefined
                      }
                      disabled={
                        brand.latest_video_count <= 0 ||
                        Boolean(brand.deleted_at)
                      }
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
                            <StarIcon color="warning" fontSize="small" />
                          </Stack>
                          <Chip
                            label={
                              brand.deleted_at
                                ? t("galgame.favorites.deleted")
                                : t("galgame.favorites.latestCount", {
                                    count: brand.latest_video_count ?? 0,
                                  })
                            }
                            color={
                              brand.deleted_at
                                ? "default"
                                : brand.latest_video_count > 0
                                  ? "secondary"
                                  : "default"
                            }
                            size="small"
                          />
                        </Stack>
                      </CardContent>
                    </CardActionArea>
                  </Card>
                </Grid>
              ))}
            </Grid>
          )
        ) : videos.data!.data.length === 0 ? (
          <GalgameState message={t("galgame.favorites.videosEmpty")} />
        ) : (
          <Grid container spacing={3}>
            {videos.data!.data.map((video) => (
              <Grid key={video.id} size={{ xs: 12, sm: 6, md: 4 }}>
                <GalgameVideoCard video={video} favorite />
              </Grid>
            ))}
          </Grid>
        )}

        {(result.data?.total ?? 0) > 0 && (
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
