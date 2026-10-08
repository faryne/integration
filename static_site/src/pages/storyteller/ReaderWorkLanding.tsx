import { storytellerCoverObjectPosition } from "@/helpers/storytellerCover.ts";
import PlayArrowIcon from "@mui/icons-material/PlayArrow";
import {
  alpha,
  Box,
  Button,
  Paper,
  Stack,
  Tab,
  Tabs,
  Typography,
} from "@mui/material";
import type { ReactNode } from "react";
import { Link as RouterLink } from "react-router-dom";
import type { ReaderLandingTab } from "./readerModel.ts";
import {
  LoreToc,
  StoryToc,
  type WorkLandingItem,
  type WorkLandingLoreGroup,
  type WorkLandingVolume,
} from "./ReaderWorkToc.tsx";

export type { WorkLandingItem, WorkLandingVolume } from "./ReaderWorkToc.tsx";

const contentWidth = 1200;

// 閱讀頁「作品首頁」：網址沒帶章節時（從卡片、分享連結進來）看到的畫面。
// 標題區塊有封面就把封面鋪成背景（同閱讀頁標題背景的做法），下面是「故事／設定」兩個 Tab：
// 故事是依冊分組的章節目錄，設定是依設定集分組的設定列表；作品沒有公開設定時不顯示 Tab。
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
  tab,
  storiesHref,
  loresHref,
  loreGroups,
  discussionsHref,
  discussionBoard,
}: {
  name: string;
  description?: string;
  coverUrl?: string;
  coverLayout: "split" | "immersive";
  coverFocalPoint: { x: number; y: number };
  meta: ReactNode;
  items: WorkLandingItem[];
  volumes: WorkLandingVolume[];
  tab: ReaderLandingTab;
  storiesHref: string;
  loresHref: string;
  loreGroups: WorkLandingLoreGroup[];
  discussionsHref: string;
  // 公開與不公開作品才有討論分頁（私人作品沒有），內容由閱讀頁組好傳進來
  discussionBoard?: ReactNode;
}) {
  const loreCount = loreGroups.reduce(
    (total, group) => total + group.lores.length,
    0,
  );
  // 沒有公開設定也沒有討論版時整個 Tab 列不顯示；網址指到不存在的 Tab 就退回故事目錄
  const activeTab: ReaderLandingTab =
    (tab === "lores" && loreCount > 0) ||
    (tab === "discussions" && discussionBoard)
      ? tab
      : "stories";
  const { startHref, startLabel } = continueReadingTarget(items);
  const completedCount = items.filter(
    (item) => item.progress?.completed,
  ).length;
  const hasProgress = items.some((item) => item.progress);

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
        startLabel={startLabel}
        readingSummary={
          hasProgress
            ? `已讀完 ${completedCount} / ${items.length} 篇`
            : undefined
        }
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
        {(loreCount > 0 || discussionBoard) && (
          <Tabs
            value={activeTab}
            sx={{ borderBottom: 1, borderColor: "divider", mb: 2 }}
          >
            <Tab
              value="stories"
              label={`故事 ${items.length}`}
              component={RouterLink}
              to={storiesHref}
            />
            {loreCount > 0 && (
              <Tab
                value="lores"
                label={`設定 ${loreCount}`}
                component={RouterLink}
                to={loresHref}
              />
            )}
            {discussionBoard && (
              <Tab
                value="discussions"
                label="討論"
                component={RouterLink}
                to={discussionsHref}
              />
            )}
          </Tabs>
        )}
        {activeTab === "discussions" ? (
          discussionBoard
        ) : activeTab === "lores" ? (
          <LoreToc groups={loreGroups} />
        ) : (
          <StoryToc items={items} volumes={volumes} />
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
  // 開始閱讀按鈕的文字，依閱讀進度可能是「繼續閱讀：〈篇名〉」；預設「開始閱讀」
  startLabel?: string;
  // 整部作品的閱讀進度摘要，例如「已讀完 3 / 24 篇」；沒讀過就不顯示
  readingSummary?: string;
}

export function WorkLandingHero({
  name,
  description,
  coverUrl,
  coverLayout,
  coverFocalPoint,
  meta,
  startHref,
  startLabel = "開始閱讀",
  readingSummary,
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
        {readingSummary && (
          <Typography variant="body2" color="text.secondary">
            {readingSummary}
          </Typography>
        )}
        {startHref && (
          <Box>
            <Button
              component={RouterLink}
              to={startHref}
              variant="contained"
              size="large"
              startIcon={<PlayArrowIcon />}
            >
              {startLabel}
            </Button>
          </Box>
        )}
      </Stack>
    </Box>
  );
}

// 「開始閱讀」按鈕要去哪：找最近讀過的那篇（以進度最後推進的時間為準），還沒讀完就回到那篇；
// 已經讀完就往下一篇；後面沒有了（例如跳著讀、最後一篇先讀完）就找第一篇還沒讀完的；
// 全部讀完才從頭開始。完全沒讀過時維持從第一篇開始。
function continueReadingTarget(items: WorkLandingItem[]) {
  const first = items[0];
  const latest = items.reduce<WorkLandingItem | undefined>(
    (found, item) =>
      item.progress &&
      (!found?.progress ||
        Date.parse(item.progress.updatedAt) >
          Date.parse(found.progress.updatedAt))
        ? item
        : found,
    undefined,
  );
  if (!latest?.progress) {
    return { startHref: first?.href, startLabel: "開始閱讀" };
  }
  const target = !latest.progress.completed
    ? latest
    : (items[items.indexOf(latest) + 1] ??
      items.find((item) => !item.progress?.completed));
  if (!target) {
    return { startHref: first?.href, startLabel: "從頭開始閱讀" };
  }
  const percent = target.progress?.progress
    ? `（${target.progress.progress}%）`
    : "";
  return {
    startHref: target.href,
    startLabel: `繼續閱讀：${target.title}${percent}`,
  };
}
