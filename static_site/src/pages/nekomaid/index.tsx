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
import { EsCursorPagination } from "@/components/common/EsCursorPagination.tsx";
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
  onImageError,
  initialPhotoIndex,
  onPhotoIndexChange,
}: {
  artwork: NekomaidArtwork;
  authorName: string;
  recommendations: NekomaidArtwork[];
  forceRecommendationBlur: boolean;
  onImageError?: () => void;
  initialPhotoIndex?: number;
  onPhotoIndexChange?: (index: number) => void;
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
          <ImageViewer
            initialIndex={initialPhotoIndex}
            onImageError={onImageError}
            onIndexChange={onPhotoIndexChange}
            photos={imagePhotos}
            title={viewerTitle}
          >
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
  const [searchParams, setSearchParams] = useSearchParams();
  const pageParam = Number.parseInt(searchParams.get("p") ?? "", 10);
  const initialPhotoIndex =
    Number.isFinite(pageParam) && pageParam > 0 ? pageParam - 1 : 0;
  const handlePhotoIndexChange = (index: number) => {
    const next = new URLSearchParams(searchParams);
    if (index > 0) {
      next.set("p", String(index + 1));
    } else {
      next.delete("p");
    }
    setSearchParams(next, { replace: true });
  };
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
  // signed url 逾時（頁面閒置太久）造成圖片載入失敗時，重新打 API 換一批新的簽名網址。
  // 一定要有重試上限與冷卻時間：如果圖片是因為其他原因（CDN 掛掉、網路擋掉）
  // 而不是單純過期而失敗，重新拿到的網址還是會壞，不做限制的話會無限重打 API。
  const imageErrorRetryRef = useRef({ artworkKey: "", attempts: 0, lastAt: 0 });
  const handleImageError = () => {
    const artworkKey = `${site}/${authorId}/${artworkId}`;
    const retry = imageErrorRetryRef.current;
    if (retry.artworkKey !== artworkKey) {
      imageErrorRetryRef.current = { artworkKey, attempts: 0, lastAt: 0 };
    }
    const state = imageErrorRetryRef.current;
    const now = Date.now();
    if (state.attempts >= 3 || now - state.lastAt < 30_000) {
      return;
    }
    state.attempts += 1;
    state.lastAt = now;
    if (!detail.isFetching) {
      detail.refetch();
    }
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
          onImageError={handleImageError}
          initialPhotoIndex={initialPhotoIndex}
          onPhotoIndexChange={handlePhotoIndexChange}
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
  const cursor = query.get("cursor") ?? "";
  const [cursorHistory, setCursorHistory] = useState<string[]>([]);
  const search = useNekomaidSearch({
    site: routeSite,
    authorId: routeAuthorId,
    tag,
    sites: routeSite ? undefined : site,
    rating,
    type,
    wallpaper,
    min_width: minWidth,
    cursor,
  });
  const payload = search.data?.data;
  const artworks = payload?.artworks ?? payload?.items ?? [];
  const total = search.data?.total;
  const author = payload?.author;
  const tags = useMemo(
    () =>
      Array.from(
        new Set([
          ...(payload?.relative_tags ?? []),
          ...artworks.flatMap((item) => item.tags ?? []),
        ]),
      ).slice(0, 40),
    [artworks, payload?.relative_tags],
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
    setCursorHistory([]);
    navigate(toListPath(params));
  };

  const toListPath = (params: URLSearchParams) => {
    const base = [routeSite, routeAuthorId].filter(Boolean).join("/");
    const queryString = params.toString();
    if (base) {
      return nekomaidPath(`${base}${queryString ? `?${queryString}` : ""}`);
    }
    return queryString ? `${nekomaidPath()}?${queryString}` : nekomaidPath();
  };

  const toSearchParams = (nextCursor?: string) => {
    const params = new URLSearchParams();
    if (tag) params.set("tag", tag);
    if (!routeSite && site) params.set("site", site);
    if (rating) params.set("rating", rating);
    if (type) params.set("type", type);
    if (wallpaper) params.set("wallpaper", wallpaper);
    if (minWidth) params.set("min_width", minWidth);
    if (nextCursor) params.set("cursor", nextCursor);
    return params;
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

          {!!search.data && total !== undefined && total > 0 && (
            <EsCursorPagination
              from={search.data.from ?? 0}
              to={search.data.to ?? 0}
              total={total}
              perPage={search.data.per_page}
              hasPrevious={cursorHistory.length > 0 || !!cursor}
              hasNext={!!search.data.has_next}
              onPrevious={() => {
                const nextHistory = [...cursorHistory];
                const previousCursor = nextHistory.pop() ?? "";
                setCursorHistory(nextHistory);
                navigate(toListPath(toSearchParams(previousCursor)));
              }}
              onNext={() => {
                if (!search.data?.next_cursor) return;
                setCursorHistory([...cursorHistory, cursor]);
                navigate(toListPath(toSearchParams(search.data.next_cursor)));
              }}
            />
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
