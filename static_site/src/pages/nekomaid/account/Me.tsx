import { useState } from "react";
import {
  Link as RouterLink,
  Navigate,
  useLocation,
  useSearchParams,
} from "react-router-dom";
import {
  Box,
  Button,
  Grid,
  Link,
  Pagination,
  Paper,
  Skeleton,
  Stack,
  Tab,
  Tabs,
  Typography,
} from "@mui/material";

import { useNekomaidSession } from "@/apis/nekomaid/accountSession.ts";
import {
  NEKOMAID_FAVORITE_PAGE_SIZE,
  useNekomaidFavoriteArtworks,
  useNekomaidFavoriteAuthors,
  useNekomaidFavoriteTags,
  useToggleNekomaidFavorite,
} from "@/apis/nekomaid/favorites.ts";
import { ConfirmDialog } from "@/components/common/ConfirmDialog.tsx";
import { CustomSnackbar } from "@/components/common/CustomSnackbar.tsx";
import { ArtworkCard } from "@/components/nekomaid/ArtworkCard.tsx";
import { NekomaidPageBreadcrumb } from "@/components/nekomaid/NekomaidBreadcrumb.tsx";
import { NewArtworkStrip } from "@/components/nekomaid/account/NewArtworkStrip.tsx";
import { apiErrorMessage } from "@/helpers/apiError.ts";
import { nekomaidPath, siteLabels } from "@/helpers/nekomaid.ts";
import { nekomaidLoginPath } from "@/helpers/nekomaidAccount.ts";
import { useTitle } from "@/helpers/title.tsx";
import type {
  NekomaidFavoriteAuthor,
  NekomaidFavoriteTag,
} from "@/types/nekomaidAccount.ts";

// 分頁：畫師／作品（存在網址的 ?tab=）
type MeTab = "authors" | "artworks" | "tags";
const ME_TABS: MeTab[] = ["authors", "artworks", "tags"];

/**
 * 我的追蹤：/me?tab=authors|artworks&page=。禁抓中的畫師／作品後端已過濾（收藏還在，解除後會回來）。
 * 取消追蹤畫師要確認；作品的愛心直接切換
 */
export default function NekomaidMe() {
  const session = useNekomaidSession();
  const location = useLocation();
  const [params, setParams] = useSearchParams();
  const tab: MeTab = ME_TABS.find((t) => t === params.get("tab")) ?? "authors";
  const page = Math.max(Number(params.get("page")) || 1, 1);
  useTitle("我的追蹤");
  if (!session) {
    return (
      <Navigate
        replace
        to={nekomaidLoginPath(location.pathname + location.search)}
      />
    );
  }

  return (
    // 內容不需要撐滿整個寬螢幕：限制寬度、靠左（麵包屑位置跟其他頁一致）
    <Stack spacing={2} sx={{ maxWidth: 1200, textAlign: "left" }}>
      <NekomaidPageBreadcrumb items={[{ label: "我的追蹤" }]} />
      <Typography component="h1" fontWeight={900} variant="h5">
        我的追蹤
      </Typography>
      <Tabs
        onChange={(_, value: MeTab) =>
          setParams(value === "authors" ? {} : { tab: value })
        }
        sx={{ borderBottom: 1, borderColor: "divider" }}
        value={tab}
      >
        <Tab label="畫師" value="authors" />
        <Tab label="作品" value="artworks" />
        <Tab label="標籤" value="tags" />
      </Tabs>
      {tab === "authors" && (
        <AuthorList
          onPage={(p) => setParams({ page: String(p) })}
          page={page}
        />
      )}
      {tab === "artworks" && (
        <ArtworkList
          onPage={(p) => setParams({ tab, page: String(p) })}
          page={page}
        />
      )}
      {tab === "tags" && (
        <TagList
          onPage={(p) => setParams({ tab, page: String(p) })}
          page={page}
        />
      )}
    </Stack>
  );
}

function ListPagination({
  total,
  page,
  onPage,
}: {
  total: number;
  page: number;
  onPage: (p: number) => void;
}) {
  if (total <= NEKOMAID_FAVORITE_PAGE_SIZE) return null;
  return (
    <Pagination
      count={Math.ceil(total / NEKOMAID_FAVORITE_PAGE_SIZE)}
      onChange={(_, p) => onPage(p)}
      page={page}
      sx={{ alignSelf: "center" }}
    />
  );
}

function Empty({ text }: { text: string }) {
  return (
    <Typography color="text.secondary" sx={{ p: 5, textAlign: "center" }}>
      {text}
    </Typography>
  );
}

function AuthorList({
  page,
  onPage,
}: {
  page: number;
  onPage: (p: number) => void;
}) {
  const list = useNekomaidFavoriteAuthors(page);
  const toggle = useToggleNekomaidFavorite();
  const [removing, setRemoving] = useState<NekomaidFavoriteAuthor | null>(null);
  const [error, setError] = useState("");
  const rows = list.data?.data ?? [];

  if (list.isPending) return <Skeleton height={240} variant="rounded" />;
  return (
    <Stack spacing={1.5}>
      {rows.length === 0 ? (
        <Empty text="還沒有追蹤的畫師" />
      ) : (
        rows.map((author) => (
          <Paper
            key={`${author.site}/${author.author_id}`}
            sx={{ p: 2 }}
            variant="outlined"
          >
            <Stack
              alignItems="center"
              direction="row"
              justifyContent="space-between"
              spacing={1}
            >
              <Box sx={{ minWidth: 0 }}>
                <Link
                  component={RouterLink}
                  fontWeight={800}
                  to={nekomaidPath(`${author.site}/${author.author_id}`)}
                  underline="hover"
                >
                  {author.nickname || author.author_id}
                </Link>
                <Typography
                  color="text.secondary"
                  component="span"
                  sx={{ ml: 1 }}
                  variant="body2"
                >
                  {siteLabels[author.site] ?? author.site} · {author.author_id}
                </Typography>
              </Box>
              <Button
                color="error"
                onClick={() => setRemoving(author)}
                size="small"
                variant="outlined"
              >
                取消追蹤
              </Button>
            </Stack>
            <NewArtworkStrip artworks={author.artworks} />
          </Paper>
        ))
      )}
      <ListPagination
        onPage={onPage}
        page={page}
        total={list.data?.total ?? 0}
      />
      <ConfirmDialog
        cancelLabel="取消"
        confirmLabel="取消追蹤"
        loading={toggle.isPending}
        message={`不再追蹤 ${removing?.nickname || removing?.author_id || ""}？`}
        onClose={() => setRemoving(null)}
        onConfirm={() => {
          if (removing)
            toggle.mutate(
              {
                kind: "authors",
                key: `${removing.site}/${removing.author_id}`,
                on: false,
              },
              {
                onError: (e) =>
                  setError(apiErrorMessage(e, "操作失敗，請稍後再試")),
              },
            );
          setRemoving(null);
        }}
        open={removing !== null}
        title="取消追蹤？"
      />
      <CustomSnackbar
        message={error}
        onClose={() => setError("")}
        open={error !== ""}
        severity="error"
      />
    </Stack>
  );
}

function ArtworkList({
  page,
  onPage,
}: {
  page: number;
  onPage: (p: number) => void;
}) {
  const list = useNekomaidFavoriteArtworks(page);
  const rows = list.data?.data ?? [];
  if (list.isPending) return <Skeleton height={240} variant="rounded" />;
  return (
    <Stack spacing={1.5}>
      {rows.length === 0 ? (
        <Empty text="還沒有收藏的作品" />
      ) : (
        <Grid container spacing={2}>
          {rows.map((artwork) => (
            <Grid
              key={`${artwork.from}/${artwork.artwork_id}`}
              size={{ xs: 6, sm: 4, md: 3, lg: 2 }}
            >
              <ArtworkCard item={artwork} />
            </Grid>
          ))}
        </Grid>
      )}
      <ListPagination
        onPage={onPage}
        page={page}
        total={list.data?.total ?? 0}
      />
    </Stack>
  );
}

/** 標籤 tab：每個收藏的標籤附「前一次登入～本次登入」之間新增、帶這個標籤的作品（規則同畫師）；取消收藏要確認 */
function TagList({
  page,
  onPage,
}: {
  page: number;
  onPage: (p: number) => void;
}) {
  const list = useNekomaidFavoriteTags(page);
  const toggle = useToggleNekomaidFavorite();
  const [removing, setRemoving] = useState<NekomaidFavoriteTag | null>(null);
  const [error, setError] = useState("");
  const rows = list.data?.data ?? [];

  if (list.isPending) return <Skeleton height={240} variant="rounded" />;
  return (
    <Stack spacing={1.5}>
      {rows.length === 0 ? (
        <Empty text="還沒有收藏的標籤" />
      ) : (
        rows.map((row) => (
          <Paper key={row.tag} sx={{ p: 2 }} variant="outlined">
            <Stack
              alignItems="center"
              direction="row"
              justifyContent="space-between"
              spacing={1}
            >
              <Link
                component={RouterLink}
                fontWeight={800}
                to={nekomaidPath(`?tag=${encodeURIComponent(row.tag)}`)}
                underline="hover"
              >
                #{row.tag}
              </Link>
              <Button
                color="error"
                onClick={() => setRemoving(row)}
                size="small"
                variant="outlined"
              >
                取消收藏
              </Button>
            </Stack>
            <NewArtworkStrip artworks={row.artworks} />
          </Paper>
        ))
      )}
      <ListPagination
        onPage={onPage}
        page={page}
        total={list.data?.total ?? 0}
      />
      <ConfirmDialog
        cancelLabel="取消"
        confirmLabel="取消收藏"
        loading={toggle.isPending}
        message={`不再收藏標籤「${removing?.tag ?? ""}」？`}
        onClose={() => setRemoving(null)}
        onConfirm={() => {
          if (removing)
            toggle.mutate(
              { kind: "tags", key: removing.tag, on: false },
              {
                onError: (e) =>
                  setError(apiErrorMessage(e, "操作失敗，請稍後再試")),
              },
            );
          setRemoving(null);
        }}
        open={removing !== null}
        title="取消收藏標籤？"
      />
      <CustomSnackbar
        message={error}
        onClose={() => setError("")}
        open={error !== ""}
        severity="error"
      />
    </Stack>
  );
}
