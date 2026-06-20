import {
  Avatar,
  Box,
  Button,
  Grid,
  Pagination,
  Paper,
  Stack,
  Tab,
  Tabs,
  Typography,
} from "@mui/material";
import OpenInNewIcon from "@mui/icons-material/OpenInNew";
import { useMemo, useState } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import axios from "axios";

import {
  useGalgameBrand,
  useGalgameBrandFavorite,
  useGalgameFavoriteStatus,
  useGalgameVideos,
} from "@/apis/galgame/catalog.ts";
import { GalgameBreadcrumb } from "@/components/galgame/GalgameBreadcrumb.tsx";
import { FavoriteButton } from "@/components/galgame/FavoriteButton.tsx";
import { GalgameVideoCard } from "@/components/galgame/GalgameVideoCard.tsx";
import { GalgameState } from "@/components/galgame/GalgameState.tsx";
import { ExpandableText } from "@/components/common/ExpandableText.tsx";
import { useTitle } from "@/helpers/title.tsx";
import { galgamePath } from "@/helpers/galgame.ts";
import { ErrorPage } from "@/pages/ErrorPage.tsx";

export default function GalgameBrand() {
  const { brandSlug } = useParams();
  const [params, setParams] = useSearchParams();
  const tab = params.get("tab") === "recent" ? "recent" : "all";
  const page = Math.max(1, Number(params.get("page")) || 1);
  const brandQuery = useGalgameBrand(brandSlug);
  const favorite = useGalgameBrandFavorite(brandSlug);
  const brand = brandQuery.data;
  const [recentFrom] = useState(() =>
    new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
  );
  const videos = useGalgameVideos(brandSlug, {
    page,
    per_page: 24,
    published_at_from: tab === "recent" ? recentFrom : undefined,
  });
  const videoFavoriteStatus = useGalgameFavoriteStatus(
    [],
    videos.data?.data.map((video) => video.id) ?? [],
  );
  const favoriteVideoIDs = new Set(videoFavoriteStatus.data?.video_ids ?? []);
  const pages = useMemo(
    () =>
      Math.max(
        1,
        Math.ceil((videos.data?.total ?? 0) / (videos.data?.per_page || 24)),
      ),
    [videos.data],
  );
  useTitle(brand ? `${brand.name} 影片` : "品牌影片");

  if (
    brandQuery.isError &&
    axios.isAxiosError(brandQuery.error) &&
    brandQuery.error.response?.status === 404
  ) {
    return <ErrorPage code={404} backUrl={`${galgamePath()}?tab=brands`} />;
  }

  return (
    <Box sx={{ pb: 6 }}>
      <GalgameBreadcrumb brand={brand} />
      <Stack spacing={3}>
        {brandQuery.isPending ? (
          <GalgameState loading message="正在載入品牌資料..." />
        ) : brandQuery.isError ? (
          <GalgameState
            severity="error"
            message="品牌資料載入失敗，請稍後再試。"
          />
        ) : brand ? (
          <Paper variant="outlined" sx={{ p: { xs: 2, md: 3 } }}>
            <Stack
              direction={{ xs: "column", md: "row" }}
              spacing={3}
              alignItems={{ xs: "center", md: "flex-start" }}
            >
              <Avatar
                src={brand.avatar_url}
                alt={brand.name}
                sx={{ width: 144, height: 144, flexShrink: 0 }}
              />
              <Stack spacing={2} sx={{ minWidth: 0, flex: 1 }}>
                <Stack direction="row" alignItems="center" spacing={0.5}>
                  <Typography variant="h3" component="h1">
                    {brand.name}
                  </Typography>
                </Stack>
                {brand.description && (
                  <ExpandableText text={brand.description} />
                )}
                <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap">
                  <FavoriteButton
                    label="品牌"
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
                      size="small"
                      endIcon={<OpenInNewIcon />}
                    >
                      {link.label}
                    </Button>
                  ))}
                </Stack>
              </Stack>
            </Stack>
          </Paper>
        ) : null}
        {brand && (
          <Tabs
            value={tab}
            onChange={(_, value: "all" | "recent") => {
              const next = new URLSearchParams(params);
              if (value === "recent") {
                next.set("tab", "recent");
              } else {
                next.delete("tab");
              }
              next.delete("page");
              setParams(next);
            }}
            aria-label="品牌影片分類"
          >
            <Tab value="all" label="所有影片" />
            <Tab value="recent" label="最新上檔影片" />
          </Tabs>
        )}
        {brand &&
          (videos.isPending ? (
            <GalgameState loading message="正在載入品牌影片..." />
          ) : videos.isError ? (
            <GalgameState
              severity="error"
              message="影片載入失敗，請稍後再試。"
            />
          ) : videos.data.data.length === 0 ? (
            <GalgameState message="此品牌目前尚無影片。" />
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
              <Pagination
                page={page}
                count={pages}
                onChange={(_, value) =>
                  setParams((current) => {
                    const next = new URLSearchParams(current);
                    if (value > 1) {
                      next.set("page", String(value));
                    } else {
                      next.delete("page");
                    }
                    return next;
                  })
                }
                sx={{ alignSelf: "center" }}
              />
            </>
          ))}
      </Stack>
    </Box>
  );
}
