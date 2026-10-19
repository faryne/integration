import ArticleIcon from "@mui/icons-material/Article";
import AutoStoriesIcon from "@mui/icons-material/AutoStories";
import CollectionsIcon from "@mui/icons-material/Collections";
import LockOutlinedIcon from "@mui/icons-material/LockOutlined";
import { Box, ButtonBase, Divider, Stack, Typography } from "@mui/material";
import { useEffect, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { Link as RouterLink, useLocation } from "react-router-dom";
import { formatStorytellerDate } from "@/data/storyteller.ts";
import { ReaderProgressBadge } from "./ReaderProgressBadge.tsx";
import { readerLoreGroupAnchorId } from "./readerModel.ts";
import type { ReaderProgress } from "./readingRecordStore.ts";

export interface WorkLandingItem {
  id: string;
  title: string;
  summary: string;
  contentType: "text" | "image";
  // 所屬冊的 id，null 代表未分冊
  parentId: number | null;
  updatedAt: string;
  href: string;
  // 讀者在這一篇的閱讀進度；沒讀過就是 undefined
  progress?: ReaderProgress;
}

export interface WorkLandingVolume {
  id: number;
  title: string;
}

export interface WorkLandingLore {
  id: string;
  title: string;
  summary: string;
  updatedAt: string;
  href: string;
  progress?: ReaderProgress;
  // 劇透設定還沒解鎖時的提示（例如「需先讀過：第三話」）；有值時這一列連標題都遮住
  lockHint?: string;
}

// 設定 Tab 的一個設定集區塊；id 為 null 代表未歸類
export interface WorkLandingLoreGroup {
  id: string | null;
  name: string;
  lores: WorkLandingLore[];
}

// 故事 Tab：依冊分組的章節目錄，沒分冊的排在最後
export function StoryToc({
  items,
  volumes,
}: {
  items: WorkLandingItem[];
  volumes: WorkLandingVolume[];
}) {
  const { t } = useTranslation();
  if (items.length === 0) {
    return <EmptyToc>{t("web.reader.landing.noContent")}</EmptyToc>;
  }
  const ungrouped = items.filter((item) => item.parentId === null);
  const groups = volumes
    .map((volume) => ({
      volume,
      children: items.filter((item) => item.parentId === volume.id),
    }))
    .filter((group) => group.children.length > 0);
  return (
    <Stack spacing={2}>
      {groups.map(({ volume, children }) => (
        <TocSection
          key={volume.id}
          title={volume.title}
          count={children.length}
          unit={t("web.reader.landing.itemUnit")}
        >
          {children.map((item, index) => (
            <StoryTocRow key={item.id} item={item} index={index} />
          ))}
        </TocSection>
      ))}
      {ungrouped.length > 0 && (
        <TocSection
          title={groups.length > 0 ? t("web.reader.landing.other") : undefined}
          count={ungrouped.length}
          unit={t("web.reader.landing.itemUnit")}
        >
          {ungrouped.map((item, index) => (
            <StoryTocRow key={item.id} item={item} index={index} />
          ))}
        </TocSection>
      )}
    </Stack>
  );
}

// 設定 Tab：比照故事目錄的樣式，依設定集分組。網址帶 #錨點（設定頁麵包屑的設定集連結）時
// 捲到對應的設定集——SPA 換頁不會自動處理 hash 捲動，要自己做。
export function LoreToc({ groups }: { groups: WorkLandingLoreGroup[] }) {
  const { t } = useTranslation();
  const { hash } = useLocation();
  useEffect(() => {
    if (hash) {
      document
        .getElementById(decodeURIComponent(hash.slice(1)))
        ?.scrollIntoView({ block: "start" });
    }
  }, [hash]);

  if (groups.length === 0) {
    return <EmptyToc>{t("web.reader.landing.noLore")}</EmptyToc>;
  }
  return (
    <Stack spacing={2}>
      {groups.map((group) => (
        <TocSection
          key={group.id ?? "uncategorized"}
          anchorId={readerLoreGroupAnchorId(group.id)}
          title={group.name}
          count={group.lores.length}
          unit={t("web.reader.landing.loreUnit")}
        >
          {group.lores.map((lore) =>
            lore.lockHint ? (
              <TocRow
                key={lore.id}
                href={lore.href}
                icon={<LockOutlinedIcon fontSize="small" />}
                title={t("web.reader.spoilerTitle")}
                summary={lore.lockHint}
                updatedAt={lore.updatedAt}
                progress={lore.progress}
              />
            ) : (
              <TocRow
                key={lore.id}
                href={lore.href}
                icon={<AutoStoriesIcon fontSize="small" />}
                title={lore.title}
                summary={lore.summary}
                updatedAt={lore.updatedAt}
                progress={lore.progress}
              />
            ),
          )}
        </TocSection>
      ))}
    </Stack>
  );
}

function EmptyToc({ children }: { children: ReactNode }) {
  return (
    <Typography color="text.secondary" sx={{ p: 2 }}>
      {children}
    </Typography>
  );
}

// 一冊（或一個設定集）的清單標題與內容
function TocSection({
  title,
  count,
  unit,
  anchorId,
  children,
}: {
  title?: string;
  count: number;
  unit?: string;
  anchorId?: string;
  children: ReactNode;
}) {
  return (
    <Stack spacing={0.5} id={anchorId} sx={{ scrollMarginTop: 96 }}>
      {title && (
        <>
          <Stack
            direction="row"
            spacing={1}
            alignItems="baseline"
            sx={{ px: 1 }}
          >
            <Typography variant="subtitle1" fontWeight={800}>
              {title}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              {count} {unit}
            </Typography>
          </Stack>
          <Divider />
        </>
      )}
      {children}
    </Stack>
  );
}

// 章節序號每一冊各自從 1 開始，與閱讀頁抽屜的作品索引一致
function StoryTocRow({
  item,
  index,
}: {
  item: WorkLandingItem;
  index: number;
}) {
  return (
    <TocRow
      href={item.href}
      icon={
        item.contentType === "image" ? (
          <CollectionsIcon fontSize="small" />
        ) : (
          <ArticleIcon fontSize="small" />
        )
      }
      title={`${index + 1}. ${item.title}`}
      summary={item.summary}
      updatedAt={item.updatedAt}
      progress={item.progress}
    />
  );
}

// 目錄的一列：故事與設定共用，兩邊的呈現（摘要截斷、進度、更新時間）才會一致
function TocRow({
  href,
  icon,
  title,
  summary,
  updatedAt,
  progress,
}: {
  href: string;
  icon: ReactNode;
  title: string;
  summary: string;
  updatedAt: string;
  progress?: ReaderProgress;
}) {
  const { i18n } = useTranslation();
  return (
    <ButtonBase
      component={RouterLink}
      to={href}
      sx={{
        display: "flex",
        alignItems: "flex-start",
        justifyContent: "flex-start",
        gap: 1.5,
        textAlign: "left",
        width: 1,
        px: 1,
        py: 1,
        borderRadius: 1,
        "&:hover": { bgcolor: "action.hover" },
      }}
    >
      <Box sx={{ color: "primary.main", pt: 0.25, display: "flex" }}>
        {icon}
      </Box>
      <Box sx={{ minWidth: 0, flex: 1 }}>
        <Typography fontWeight={700}>{title}</Typography>
        {summary && (
          <Typography
            variant="body2"
            color="text.secondary"
            sx={{
              display: "-webkit-box",
              WebkitLineClamp: 2,
              WebkitBoxOrient: "vertical",
              overflow: "hidden",
            }}
          >
            {summary}
          </Typography>
        )}
      </Box>
      <Stack
        direction="row"
        spacing={1.5}
        alignItems="center"
        sx={{ pt: 0.25, flexShrink: 0 }}
      >
        <ReaderProgressBadge progress={progress} />
        <Typography
          variant="caption"
          color="text.secondary"
          sx={{ display: { xs: "none", sm: "block" } }}
        >
          {formatStorytellerDate(updatedAt, i18n.resolvedLanguage)}
        </Typography>
      </Stack>
    </ButtonBase>
  );
}
