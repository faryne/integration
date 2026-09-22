import ArticleIcon from "@mui/icons-material/Article";
import CollectionsIcon from "@mui/icons-material/Collections";
import PlayArrowIcon from "@mui/icons-material/PlayArrow";
import {
  alpha,
  Box,
  Button,
  ButtonBase,
  Divider,
  Paper,
  Stack,
  Typography,
} from "@mui/material";
import type { ReactNode } from "react";
import { Link as RouterLink } from "react-router-dom";
import { formatStorytellerDate } from "@/data/storyteller.ts";
import { storytellerCoverObjectPosition } from "@/helpers/storytellerCover.ts";

export interface WorkLandingItem {
  id: string;
  title: string;
  summary: string;
  contentType: "text" | "image";
  // 所屬冊的 id，null 代表未分冊
  parentId: number | null;
  updatedAt: string;
  href: string;
}

export interface WorkLandingVolume {
  id: number;
  title: string;
}

const contentWidth = 1200;

// 閱讀頁「作品首頁」：網址沒帶章節時（從卡片、分享連結進來）看到的畫面。
// 標題區塊有封面就把封面鋪成背景（同閱讀頁標題背景的做法），下面是依冊分組的章節目錄。
// 純呈現元件：作品資訊 chips／追蹤與評分按鈕由呼叫端組好用 meta 傳入，章節連結用 item.href，
// 這樣不必回頭 import Reader.tsx（避免循環引用）。
export function ReaderWorkLanding({
  name,
  description,
  coverUrl,
  coverLayout,
  coverFocalPoint,
  meta,
  items,
  volumes,
}: {
  name: string;
  description?: string;
  coverUrl?: string;
  coverLayout: "split" | "immersive";
  coverFocalPoint: { x: number; y: number };
  meta: ReactNode;
  items: WorkLandingItem[];
  volumes: WorkLandingVolume[];
}) {
  const startHref = items[0]?.href;
  const ungrouped = items.filter((item) => item.parentId === null);
  const groups = volumes
    .map((volume) => ({
      volume,
      children: items.filter((item) => item.parentId === volume.id),
    }))
    .filter((group) => group.children.length > 0);

  return (
    <Stack spacing={{ xs: 2, md: 3 }} sx={{ width: 1, alignItems: "center" }}>
      <WorkLandingHero
        name={name}
        description={description}
        coverUrl={coverUrl}
        coverLayout={coverLayout}
        coverFocalPoint={coverFocalPoint}
        meta={meta}
        startHref={startHref}
      />

      <Paper
        variant="outlined"
        sx={{
          width: 1,
          maxWidth: contentWidth,
          boxSizing: "border-box",
          borderRadius: 0,
          borderColor: "divider",
          bgcolor: "background.paper",
          backgroundImage: "none",
          p: { xs: 1, sm: 2 },
        }}
      >
        {items.length === 0 ? (
          <Typography color="text.secondary" sx={{ p: 2 }}>
            這個作品還沒有公開的內容。
          </Typography>
        ) : (
          <Stack spacing={2}>
            {groups.map(({ volume, children }) => (
              <TocSection
                key={volume.id}
                title={volume.title}
                items={children}
              />
            ))}
            {ungrouped.length > 0 && (
              <TocSection
                title={groups.length > 0 ? "其他" : undefined}
                items={ungrouped}
              />
            )}
          </Stack>
        )}
      </Paper>
    </Stack>
  );
}

// 桌機依創作者選擇呈現圖文分區或沉浸式 Hero；手機一律讓圖片獨立置頂，避免文字遮住封面。
// 匯出給 StorytellerProjectCoverEditor 的設定頁預覽直接重用——同一份 markup，設定頁
// 看到的排版才會跟真正的目次頁完全一致，不用另外手刻一份、之後改版還要記得同步兩邊。
export interface WorkLandingHeroProps {
  name: string;
  description?: string;
  coverUrl?: string;
  coverLayout: "split" | "immersive";
  coverFocalPoint: { x: number; y: number };
  meta: ReactNode;
  startHref?: string;
}

export function WorkLandingHero({
  name,
  description,
  coverUrl,
  coverLayout,
  coverFocalPoint,
  meta,
  startHref,
}: WorkLandingHeroProps) {
  const immersive = Boolean(coverUrl && coverLayout === "immersive");
  const split = Boolean(coverUrl && coverLayout === "split");
  // 焦點只有沉浸式版型才生效，圖文分區統一置中——見 storytellerCoverObjectPosition。
  const focalPosition = storytellerCoverObjectPosition(
    coverLayout,
    coverFocalPoint,
  );

  return (
    <Box
      sx={(theme) => ({
        width: 1,
        maxWidth: contentWidth,
        boxSizing: "border-box",
        display: split ? { xs: "flex", md: "grid" } : "flex",
        flexDirection: "column",
        gridTemplateColumns: "minmax(0, 58fr) minmax(320px, 42fr)",
        alignItems: immersive ? "flex-end" : "stretch",
        minHeight: coverUrl ? { md: 360 } : undefined,
        border: "1px solid",
        borderColor: "divider",
        bgcolor: "background.paper",
        overflow: "hidden",
        ...(immersive && {
          backgroundImage: {
            xs: "none",
            md: `linear-gradient(90deg, ${alpha(theme.palette.background.paper, 0.97)} 0%, ${alpha(theme.palette.background.paper, 0.86)} 48%, ${alpha(theme.palette.background.paper, 0.35)} 76%, transparent 100%), url("${coverUrl}")`,
          },
          backgroundSize: "cover",
          backgroundPosition: focalPosition,
        }),
      })}
    >
      {coverUrl && (
        <Box
          component="img"
          src={coverUrl}
          alt=""
          sx={{
            width: 1,
            height: split ? { xs: "auto", md: 1 } : "auto",
            aspectRatio: { xs: "16 / 9", md: split ? "auto" : "16 / 9" },
            objectFit: "cover",
            objectPosition: focalPosition,
            display: immersive ? { xs: "block", md: "none" } : "block",
            order: { xs: 1, md: 2 },
          }}
        />
      )}
      <Stack
        spacing={1.5}
        justifyContent="flex-end"
        sx={{
          width: 1,
          boxSizing: "border-box",
          order: { xs: 2, md: 1 },
          px: { xs: 2, sm: 4 },
          py: { xs: 3, sm: 5 },
        }}
      >
        <Typography
          component="h1"
          variant="h3"
          fontWeight={800}
          sx={{ letterSpacing: "-0.035em" }}
        >
          {name}
        </Typography>
        {description && (
          <Typography color="text.secondary">{description}</Typography>
        )}
        <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
          {meta}
        </Stack>
        {startHref && (
          <Box>
            <Button
              component={RouterLink}
              to={startHref}
              variant="contained"
              size="large"
              startIcon={<PlayArrowIcon />}
            >
              開始閱讀
            </Button>
          </Box>
        )}
      </Stack>
    </Box>
  );
}

// 一冊（或未分冊）的章節清單；序號每一冊各自從 1 開始，與閱讀頁抽屜的作品索引一致。
function TocSection({
  title,
  items,
}: {
  title?: string;
  items: WorkLandingItem[];
}) {
  return (
    <Stack spacing={0.5}>
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
              {items.length} 篇
            </Typography>
          </Stack>
          <Divider />
        </>
      )}
      {items.map((item, index) => (
        <ButtonBase
          key={item.id}
          component={RouterLink}
          to={item.href}
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
            {item.contentType === "image" ? (
              <CollectionsIcon fontSize="small" />
            ) : (
              <ArticleIcon fontSize="small" />
            )}
          </Box>
          <Box sx={{ minWidth: 0, flex: 1 }}>
            <Typography fontWeight={700}>
              {index + 1}. {item.title}
            </Typography>
            {item.summary && (
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
                {item.summary}
              </Typography>
            )}
          </Box>
          <Typography
            variant="caption"
            color="text.secondary"
            sx={{
              display: { xs: "none", sm: "block" },
              pt: 0.5,
              flexShrink: 0,
            }}
          >
            {formatStorytellerDate(item.updatedAt)}
          </Typography>
        </ButtonBase>
      ))}
    </Stack>
  );
}
