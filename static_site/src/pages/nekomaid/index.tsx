import {
  Alert,
  Box,
  Button,
  Chip,
  Grid,
  Link,
  Paper,
  Skeleton,
  Snackbar,
  Stack,
  Typography,
} from "@mui/material";
import OpenInNewIcon from "@mui/icons-material/OpenInNew";
import ShareIcon from "@mui/icons-material/Share";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  Link as RouterLink,
  useNavigate,
  useParams,
  useSearchParams,
} from "react-router-dom";
import {
  useNekomaidArtworkDetail,
  useNekomaidSearch,
} from "@/apis/nekomaid/search.ts";
import { ArtworkCard } from "@/components/nekomaid/ArtworkCard.tsx";
import {
  AgeConfirmationDialog,
  AgeConfirmationPanel,
} from "@/components/common/AgeConfirmation.tsx";
import { ImageViewer } from "@/components/common/ImageViewer.tsx";
import { isVideoMedia, VideoViewer } from "@/components/common/VideoViewer.tsx";
import { CollapsibleRelatedTags } from "@/components/nekomaid/CollapsibleRelatedTags.tsx";
import { CompactRecommendations } from "@/components/nekomaid/CompactRecommendations.tsx";
import { NekomaidBreadcrumb } from "@/components/nekomaid/NekomaidBreadcrumb.tsx";
import {
  type NekomaidSearchFormValue,
  SearchPanel,
} from "@/components/nekomaid/SearchPanel.tsx";
import {
  PaypalDonateCard,
  UserscriptPromotionCard,
} from "@/components/nekomaid/SidebarCards.tsx";
import {
  artworkShareUrl,
  artworkPhotoCount,
  externalArtworkUrl,
  externalAuthorUrl,
  isAnimatedArtwork,
  isR18Artwork,
  itemSite,
  nekomaidPath,
  siteLabels,
  setR18ConfirmedCookie,
  useR18Confirmed,
} from "@/helpers/nekomaid.ts";
import { shareUrl } from "@/helpers/share.ts";
import { useTitle } from "@/helpers/title.tsx";
import { ErrorPage } from "@/pages/ErrorPage.tsx";
import type { NekomaidArtwork } from "@/types/nekomaid.ts";
import type { NekomaidPhoto } from "@/types/nekomaid.ts";

function formatFileSize(size?: number) {
  if (!size || size <= 0) {
    return "";
  }
  if (size >= 1024 * 1024) {
    return `${(size / 1024 / 1024).toFixed(2)} MB`;
  }
  if (size >= 1024) {
    return `${(size / 1024).toFixed(1)} KB`;
  }
  return `${size} B`;
}

function imageMetadataLines(photo: NekomaidPhoto) {
  const dimensions =
    photo.width && photo.height
      ? `${Math.round(photo.width)} x ${Math.round(photo.height)} px`
      : "";
  const fileSize = formatFileSize(photo.size);
  return [dimensions, fileSize].filter(Boolean);
}

function ArtworkInfoPanel({
  artwork,
  authorName,
  recommendations,
  forceRecommendationBlur,
}: {
  artwork: NekomaidArtwork;
  authorName: string;
  recommendations: NekomaidArtwork[];
  forceRecommendationBlur: boolean;
}) {
  const title = artwork.title || "未命名作品";
  const [shareNotice, setShareNotice] = useState("");

  const handleShare = async () => {
    const result = await shareUrl({
      title: `${title} | 難以名狀的抓圖器`,
      url: artworkShareUrl(artwork),
    });
    if (result === "copied") {
      setShareNotice("分享連結已複製");
    } else if (result === "failed") {
      setShareNotice("無法分享連結");
    }
  };

  return (
    <Paper
      variant="outlined"
      sx={{
        backdropFilter: "blur(18px)",
        bgcolor: "rgba(255, 255, 255, 0.92)",
        borderRadius: 2,
        boxShadow: "0 18px 60px rgba(15, 23, 42, 0.24)",
        maxHeight: { xs: "58vh", md: "min(68vh, 720px)" },
        overflow: "auto",
        p: { xs: 2, md: 2.5 },
      }}
    >
      <Stack spacing={2}>
        <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
          <Chip label={siteLabels[itemSite(artwork)] ?? itemSite(artwork)} />
          {isR18Artwork(artwork) && (
            <Chip color="error" label="R18" variant="outlined" />
          )}
          {artworkPhotoCount(artwork) > 1 && (
            <Chip
              label={`漫畫（共${artworkPhotoCount(artwork)}張）`}
              variant="outlined"
            />
          )}
          {isAnimatedArtwork(artwork) && (
            <Chip color="secondary" label="動圖" variant="outlined" />
          )}
        </Stack>

        <Box>
          <Typography
            component="h2"
            fontWeight={950}
            sx={{
              fontSize: { xs: "1.65rem", md: "2.25rem" },
              lineHeight: 1.15,
            }}
          >
            {title}
          </Typography>
          <Typography color="text.secondary" sx={{ mt: 1 }} variant="subtitle1">
            by{" "}
            <Link
              component={RouterLink}
              to={nekomaidPath(`${itemSite(artwork)}/${artwork.author_id}`)}
              underline="hover"
              sx={{ fontWeight: 800 }}
            >
              {authorName}
            </Link>
            <Box component="span" sx={{ mx: 0.75 }}>
              /
            </Box>
            <Box component="span">作者 ID：{artwork.author_id}</Box>
          </Typography>
        </Box>

        <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
          {externalArtworkUrl(artwork) && (
            <Button
              component="a"
              href={externalArtworkUrl(artwork)}
              target="_blank"
              rel="noreferrer"
              startIcon={<OpenInNewIcon />}
              variant="contained"
            >
              圖片原始頁
            </Button>
          )}
          {externalAuthorUrl(artwork) && (
            <Button
              component="a"
              href={externalAuthorUrl(artwork)}
              target="_blank"
              rel="noreferrer"
              variant="outlined"
            >
              畫師頁面
            </Button>
          )}
          <Button
            component={RouterLink}
            to={nekomaidPath(`${itemSite(artwork)}/${artwork.author_id}`)}
            variant="outlined"
          >
            同畫師作品
          </Button>
          <Button
            onClick={handleShare}
            startIcon={<ShareIcon />}
            variant="outlined"
          >
            分享
          </Button>
        </Stack>

        <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
          {artwork.tags?.map((tag) => (
            <Chip
              key={tag}
              label={tag}
              component={RouterLink}
              to={nekomaidPath(`?tag=${encodeURIComponent(tag)}`)}
              clickable
              size="small"
            />
          ))}
        </Stack>

        <CompactRecommendations
          items={recommendations}
          forceBlur={forceRecommendationBlur}
        />
      </Stack>
      <Snackbar
        autoHideDuration={2400}
        message={shareNotice}
        onClose={() => setShareNotice("")}
        open={Boolean(shareNotice)}
      />
    </Paper>
  );
}

function DetailContent({
  artwork,
  authorName,
  recommendations,
  forceRecommendationBlur,
}: {
  artwork: NekomaidArtwork;
  authorName: string;
  recommendations: NekomaidArtwork[];
  forceRecommendationBlur: boolean;
}) {
  const viewerAnchorRef = useRef<HTMLDivElement | null>(null);
  const photos = artwork.photos ?? [];
  const hasVideo = photos.some(isVideoMedia);
  const imagePhotos = hasVideo
    ? photos
    : photos.map((photo) => ({
        ...photo,
        description: photo.description,
        metadataLines: imageMetadataLines(photo),
      }));
  const viewerTitle = artwork.title || "未命名作品";
  const infoPanel = (
    <Box sx={{ maxWidth: { xs: "100%", md: 520, xl: 620 } }}>
      <ArtworkInfoPanel
        artwork={artwork}
        authorName={authorName}
        recommendations={recommendations}
        forceRecommendationBlur={forceRecommendationBlur}
      />
    </Box>
  );
  const viewerKey = `${itemSite(artwork)}-${artwork.author_id}-${artwork.artwork_id}`;

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      viewerAnchorRef.current?.scrollIntoView({
        behavior: "smooth",
        block: "center",
      });
    });

    return () => window.cancelAnimationFrame(frame);
  }, [viewerKey]);

  return (
    <Stack spacing={1.5} sx={{ minWidth: 0 }}>
      <NekomaidBreadcrumb
        site={itemSite(artwork)}
        authorId={artwork.author_id}
        authorName={authorName}
        title={artwork.title}
        artworkId={artwork.artwork_id}
      />
      <Box
        id="nekomaid-artwork-viewer"
        ref={viewerAnchorRef}
        sx={{ scrollMarginBlock: "24px" }}
      >
        {hasVideo ? (
          <VideoViewer videos={photos} title={viewerTitle}>
            {infoPanel}
          </VideoViewer>
        ) : (
          <ImageViewer photos={imagePhotos} title={viewerTitle}>
            {infoPanel}
          </ImageViewer>
        )}
      </Box>
    </Stack>
  );
}

function DetailPage({
  site,
  authorId,
  artworkId,
}: {
  site: string;
  authorId: string;
  artworkId: string;
}) {
  const detail = useNekomaidArtworkDetail(site, authorId, artworkId);
  const artwork = detail.data?.artwork;
  const author = detail.data?.author;
  const recommendations = detail.data?.recommendations?.slice(0, 24) ?? [];
  const r18Confirmed = useR18Confirmed();
  const requiresAgeConfirmation = artwork ? isR18Artwork(artwork) : false;
  const canShowArtworkImages = !requiresAgeConfirmation || r18Confirmed;
  const authorLabel =
    author?.nickname || `作者 ${artwork?.author_id ?? authorId}`;
  const detailDescription = artwork
    ? [
        `「${artwork.title || artwork.artwork_id}」`,
        `作者：${authorLabel}`,
        `來源：${siteLabels[itemSite(artwork)] ?? itemSite(artwork)}`,
        artworkPhotoCount(artwork) > 1
          ? `漫畫（共${artworkPhotoCount(artwork)}張）`
          : "",
      ]
        .filter(Boolean)
        .join("，")
    : undefined;
  const confirmR18 = () => {
    setR18ConfirmedCookie();
  };

  useTitle(artwork?.title ?? "難以名狀的抓圖器", {
    description: detailDescription,
    image:
      artwork && !isR18Artwork(artwork)
        ? artwork.thumb || artwork.photos?.[0]?.url
        : undefined,
    path: nekomaidPath(`${site}/${authorId}/${artworkId}`),
    type: "article",
  });

  if (detail.isLoading) {
    return <Skeleton height={420} variant="rounded" />;
  }

  if (detail.isError || !artwork) {
    return (
      <ErrorPage
        code={404}
        backUrl={nekomaidPath()}
        message="找不到這個作品。請確認連結是否正確，或回到難以名狀的抓圖器重新搜尋。"
      />
    );
  }

  return (
    <Stack spacing={3}>
      {canShowArtworkImages ? (
        <DetailContent
          artwork={artwork}
          authorName={authorLabel}
          recommendations={recommendations}
          forceRecommendationBlur={requiresAgeConfirmation && !r18Confirmed}
        />
      ) : (
        <AgeConfirmationPanel
          description="請先確認你已年滿 18 歲，確認後才會顯示完整圖片。"
          onConfirm={confirmR18}
          title="這個作品包含成人內容"
        />
      )}

      <AgeConfirmationDialog
        description="這個作品標示為 R18。請確認你已年滿 18 歲，並同意繼續瀏覽成人內容。"
        leaveTo={nekomaidPath()}
        onConfirm={confirmR18}
        open={requiresAgeConfirmation && !r18Confirmed}
      />
    </Stack>
  );
}

function ListPage({
  routeSite,
  routeAuthorId,
}: {
  routeSite?: string;
  routeAuthorId?: string;
}) {
  const navigate = useNavigate();
  const [query] = useSearchParams();
  const tag = query.get("tag") ?? "";
  const site = routeSite ?? query.get("site") ?? "";
  const rating = query.get("rating") ?? "";
  const type = query.get("type") ?? "";
  const wallpaper = query.get("wallpaper") ?? "";
  const minWidth = query.get("min_width") ?? "";
  const search = useNekomaidSearch({
    site: routeSite,
    authorId: routeAuthorId,
    tag,
    sites: routeSite ? undefined : site,
    rating,
    type,
    wallpaper,
    min_width: minWidth,
  });
  const artworks =
    search.data?.pages.flatMap((page) => page.artworks ?? page.items ?? []) ??
    [];
  const total = search.data?.pages[0]?.total;
  const author = search.data?.pages[0]?.author;
  const tags = useMemo(
    () =>
      Array.from(
        new Set([
          ...(search.data?.pages[0]?.relative_tags ?? []),
          ...artworks.flatMap((item) => item.tags ?? []),
        ]),
      ).slice(0, 40),
    [artworks, search.data?.pages],
  );

  useTitle("難以名狀的抓圖器", { path: nekomaidPath() });

  const applySearch = (next: NekomaidSearchFormValue) => {
    const params = new URLSearchParams();
    if (next.tag) params.set("tag", next.tag);
    if (next.site) params.set("site", next.site);
    if (next.rating) params.set("rating", next.rating);
    if (next.type) params.set("type", next.type);
    if (next.wallpaper) params.set("wallpaper", next.wallpaper);
    if (next.minWidth) params.set("min_width", next.minWidth);
    navigate(nekomaidPath(`?${params.toString()}`));
  };

  return (
    <Box
      sx={{
        display: "grid",
        gap: 3,
        gridTemplateColumns: { xs: "1fr", lg: "320px minmax(0, 1fr)" },
      }}
    >
      <Box sx={{ order: { xs: 2, lg: 1 } }}>
        <Box sx={{ position: { md: "sticky" }, top: 24 }}>
          <Stack spacing={2}>
            <SearchPanel
              site={routeSite ? "" : site}
              tag={tag}
              rating={rating}
              type={type}
              wallpaper={wallpaper}
              minWidth={minWidth}
              onSearch={applySearch}
            />
            <UserscriptPromotionCard />
            <PaypalDonateCard />
          </Stack>
        </Box>
      </Box>
      <Box sx={{ minWidth: 0, order: { xs: 1, lg: 2 } }}>
        <Stack spacing={2.5}>
          {(routeSite || routeAuthorId || author?.nickname) && (
            <NekomaidBreadcrumb
              site={routeSite}
              authorId={routeAuthorId}
              authorName={author?.nickname}
            />
          )}

          <Stack
            direction={{ xs: "column", sm: "row" }}
            justifyContent="space-between"
            spacing={1.5}
          >
            <Box>
              <Typography fontWeight={900} variant="h5">
                搜尋結果
              </Typography>
              <Typography color="text.secondary" variant="body2">
                {author?.nickname
                  ? `${author.nickname} 的作品`
                  : typeof total === "number"
                    ? `共 ${total.toLocaleString()} 筆資料`
                    : "讀取中"}
              </Typography>
            </Box>
            <Button
              component={RouterLink}
              to={nekomaidPath()}
              variant="outlined"
            >
              清除條件
            </Button>
          </Stack>

          <CollapsibleRelatedTags tags={tags} />

          {search.isError && (
            <Alert severity="error">搜尋發生錯誤，請稍後再試。</Alert>
          )}
          {search.isLoading && (
            <Grid container spacing={2}>
              {Array.from({ length: 8 }).map((_, index) => (
                <Grid key={index} size={{ xs: 6, sm: 4, md: 3 }}>
                  <Skeleton height={280} variant="rounded" />
                </Grid>
              ))}
            </Grid>
          )}
          {!search.isLoading && artworks.length === 0 && !search.isError && (
            <Alert severity="info">沒有符合條件的作品。</Alert>
          )}

          <Box
            sx={{
              display: "grid",
              gap: 2,
              gridTemplateColumns: {
                xs: "repeat(2, minmax(0, 1fr))",
                sm: "repeat(auto-fill, minmax(180px, 1fr))",
              },
            }}
          >
            {artworks.map((item) => (
              <ArtworkCard
                key={`${itemSite(item)}-${item.author_id}-${item.artwork_id}`}
                item={item}
              />
            ))}
          </Box>

          {search.hasNextPage && (
            <Button
              disabled={search.isFetchingNextPage}
              onClick={() => search.fetchNextPage()}
              variant="contained"
              sx={{ alignSelf: "center" }}
            >
              {search.isFetchingNextPage ? "讀取中" : "載入更多"}
            </Button>
          )}
        </Stack>
      </Box>
    </Box>
  );
}

export default function NekomaidPage() {
  const { site, authorId, artworkId } = useParams();
  const isDetail = Boolean(site && authorId && artworkId);

  return (
    <Box sx={{ width: "100%" }}>
      <Stack spacing={3}>
        {isDetail ? (
          <DetailPage
            site={site!}
            authorId={authorId!}
            artworkId={artworkId!}
          />
        ) : (
          <ListPage routeSite={site} routeAuthorId={authorId} />
        )}
      </Stack>
    </Box>
  );
}
