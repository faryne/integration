import { WorkspaceEmptyState } from "@steamloom-web/components/storyteller/WorkspaceEmptyState.tsx";
import ArticleIcon from "@mui/icons-material/Article";
import CollectionsIcon from "@mui/icons-material/Collections";
import { Box, ButtonBase, Card, CardMedia, Chip, CircularProgress, Pagination, Stack, Typography } from "@mui/material";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { backend, type DocumentItem, type ListedDocument } from "@/lib/backend.ts";
import { dateTimeFormat } from "@/lib/format.ts";
import { useBackendData } from "@/lib/useBackendData.ts";

export type ListSection = "stories" | "lores" | "assets";

// 沒有內容時的空狀態用網站工作台同一個元件，兩邊長得一樣
function Empty({ kind }: { kind: "story" | "lore" | "asset" }) {
  const { t } = useTranslation();
  const icon = { story: <ArticleIcon />, lore: <ArticleIcon />, asset: <CollectionsIcon /> }[kind];
  return <WorkspaceEmptyState icon={icon} title={t(`workspace.list.empty.${kind}.title`)} description={t(`workspace.list.empty.${kind}.description`)} />;
}

// 「全部作品／全部設定」：版面比照網站工作台的列表（標題、所屬分組、字數、更新時間、狀態），點一列就打開它。
// version 變動（建立、移動、排序之後）就重新抓。
export function DocumentListPanel({
  project,
  kind,
  version,
  onOpen,
}: {
  project: string;
  kind: "story" | "lore";
  version: number;
  onOpen: (item: DocumentItem) => void;
}) {
  const { t } = useTranslation();
  const rows = useBackendData(() => backend.ListDocuments(project, kind), [project, kind, version]);
  if (rows === null) return <CircularProgress size={24} sx={{ m: 4 }} />;
  return (
    <Box sx={{ flex: 1, overflow: "auto", px: 3, py: 2.5 }}>
      <Stack sx={{ maxWidth: 960 }} divider={<Box sx={{ borderBottom: 1, borderColor: "divider" }} />}>
        {!rows?.length && <Empty kind={kind} />}
        {(rows ?? []).map((row: ListedDocument) => (
          <ButtonBase
            key={row.public_id}
            onClick={() => onOpen({ kind: row.kind, public_id: row.public_id, title: row.title, content_type: row.content_type })}
            sx={{ justifyContent: "flex-start", textAlign: "left", gap: 1.5, px: 1.5, py: 1.25, borderRadius: 1, "&:hover": { bgcolor: "action.hover" } }}
          >
            {row.content_type === "image" ? <CollectionsIcon fontSize="small" color="action" /> : <ArticleIcon fontSize="small" color="action" />}
            <Box sx={{ flex: 1, minWidth: 0 }}>
              <Typography noWrap fontWeight={500}>
                {row.title}
              </Typography>
              <Typography variant="caption" color="text.secondary" component="div" noWrap>
                {[
                  row.group_name,
                  row.content_type === "image" ? t("workspace.list.image") : t("workspace.list.wordCount", { words: row.word_count.toLocaleString() }),
                  t("workspace.list.updatedAt", { date: dateTimeFormat.format(new Date(row.updated_at)) }),
                ]
                  .filter(Boolean)
                  .join(" · ")}
              </Typography>
            </Box>
            {row.status && <Chip size="small" variant="outlined" label={t(`workspace.status.${row.status}`, row.status)} />}
          </ButtonBase>
        ))}
      </Stack>
    </Box>
  );
}

const sizeFormat = (bytes: number) => (bytes >= 1 << 20 ? `${(bytes / (1 << 20)).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`);

// 「全部資產」：縮圖格狀排列，每頁 24 筆（跟網站一致）。
export function AssetListPanel({ project, version }: { project: string; version: number }) {
  const [page, setPage] = useState(1);
  const data = useBackendData(() => backend.Assets(project, page), [project, page, version]);
  if (data === null) return <CircularProgress size={24} sx={{ m: 4 }} />;
  const assets = data?.assets ?? [];
  const pageCount = data ? Math.max(1, Math.ceil(data.total_count / data.page_size)) : 1;
  return (
    <Box sx={{ flex: 1, overflow: "auto", px: 3, py: 2.5 }}>
      {!assets.length && <Empty kind="asset" />}
      <Box sx={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))", gap: 2, maxWidth: 1080 }}>
        {assets.map((asset) => (
          <Card key={asset.public_id} variant="outlined">
            <CardMedia component="img" image={asset.preview_url} alt={asset.title} sx={{ height: 120, objectFit: "cover", bgcolor: "background.default" }} />
            <Box sx={{ px: 1.25, py: 1 }}>
              <Typography variant="body2" noWrap title={asset.title}>
                {asset.title}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                {sizeFormat(asset.file_size)}
              </Typography>
            </Box>
          </Card>
        ))}
      </Box>
      {pageCount > 1 && <Pagination sx={{ mt: 2.5 }} page={page} count={pageCount} onChange={(_, next) => setPage(next)} />}
    </Box>
  );
}
