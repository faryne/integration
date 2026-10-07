import AutoStoriesIcon from "@mui/icons-material/AutoStories";
import CloseIcon from "@mui/icons-material/Close";
import OpenInNewIcon from "@mui/icons-material/OpenInNew";
import {
  Box,
  Button,
  Divider,
  Drawer,
  IconButton,
  Popover,
  Stack,
  Typography,
  useMediaQuery,
  useTheme,
} from "@mui/material";
import { useId, useState, type ReactNode } from "react";
import { Link as RouterLink } from "react-router-dom";
import {
  readerLorePath,
  readerStoryPath,
} from "@/helpers/storytellerReaderPaths.ts";
import {
  plainTextFromMarkdown,
  type ReaderLore,
} from "@/pages/storyteller/readerModel.ts";
import {
  ReaderSpoilerGate,
  type ReaderSpoilerDependency,
} from "@/pages/storyteller/ReaderSpoilerGate.tsx";
import {
  ReaderTextFrame,
  StoryContentLines,
} from "@/pages/storyteller/ReaderStoryContent.tsx";
import {
  readingTargetKey,
  type ReaderProgressMap,
} from "@/pages/storyteller/readingRecordStore.ts";
import { StorytellerLoreLinkContext } from "@/pages/storyteller/storytellerLoreLinkContext.ts";
import { StorytellerFootnoteSection } from "@/pages/storyteller/StorytellerWysiwygMarkdown.tsx";
import type { StorytellerTypographyPreferences } from "@/pages/storyteller/useStorytellerTypographyPreferences.ts";
import { computeFootnoteNumbering } from "@/pages/storyteller/wysiwygCore/parser.ts";

// 摘要小卡沒有摘要時，取正文前這麼多字代替
const SUMMARY_FALLBACK_LENGTH = 120;
const NO_LINES = new Set<number>();
const noop = () => undefined;

// 劇透判斷由 Reader 的 useLoreSpoilerGate 傳進來，這裡只負責呈現
interface LoreSpoilerGateApi {
  isLocked: (lore: ReaderLore) => boolean;
  unmetDependencies: (lore: ReaderLore) => ReaderLore["dependsOn"];
  confirm: (loreId: string) => void;
  displayTitle: (lore: ReaderLore) => string;
}

// 閱讀內容裡的設定連結：點了先開摘要小卡，「看完整設定」再開側邊面板（手機是底部抽屜），
// 都不離開目前的閱讀位置。只認得已公開的設定（lores 只含讀者讀得到的），其他一律顯示純文字，
// 讀者不會知道那裡有一則未公開的設定。面板裡的設定內文也可以再連到別的設定。
export function ReaderLoreLinkProvider({
  lores,
  collectionNames,
  basePath,
  gate,
  progressMap,
  preferences,
  onLoreRead,
  children,
}: {
  lores: ReaderLore[];
  // 設定集 public_id → 名稱
  collectionNames: Map<string, string>;
  basePath: string;
  gate: LoreSpoilerGateApi;
  progressMap: ReaderProgressMap;
  preferences: StorytellerTypographyPreferences;
  // 讀者在面板裡打開完整內容時呼叫（記成讀過）
  onLoreRead: (loreId: string) => void;
  children: ReactNode;
}) {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("sm"));
  const [card, setCard] = useState<{
    loreId: string;
    anchor: HTMLElement;
  } | null>(null);
  const [panelLoreId, setPanelLoreId] = useState<string | null>(null);
  const loreById = new Map(lores.map((lore) => [lore.id, lore]));
  const cardLore = card ? loreById.get(card.loreId) : undefined;
  const panelLore = panelLoreId ? loreById.get(panelLoreId) : undefined;

  const openPanel = (lore: ReaderLore) => {
    setCard(null);
    setPanelLoreId(lore.id);
    if (!gate.isLocked(lore)) {
      onLoreRead(lore.id);
    }
  };

  const spoilerDependencies = (lore: ReaderLore): ReaderSpoilerDependency[] =>
    gate.unmetDependencies(lore).map((dependency) => {
      const key = readingTargetKey(dependency.type, dependency.id);
      return {
        key,
        type: dependency.type,
        title: dependency.title,
        href:
          dependency.type === "story"
            ? readerStoryPath(basePath, dependency.id)
            : readerLorePath(basePath, dependency.id),
        progress: progressMap[key],
      };
    });

  const renderLoreLink = (loreId: string, text: ReactNode) => {
    const lore = loreById.get(loreId);
    if (!lore) {
      return null;
    }
    return (
      <Box
        component="span"
        role="button"
        tabIndex={0}
        aria-haspopup="dialog"
        onClick={(event) => setCard({ loreId, anchor: event.currentTarget })}
        onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            setCard({ loreId, anchor: event.currentTarget });
          }
        }}
        sx={{
          color: "secondary.main",
          textDecoration: "underline dotted",
          textUnderlineOffset: "0.2em",
          cursor: "pointer",
          borderRadius: 0.5,
          "&:hover, &:focus-visible": {
            bgcolor: "action.hover",
            outline: "none",
          },
        }}
      >
        {text}
      </Box>
    );
  };

  return (
    <StorytellerLoreLinkContext.Provider value={renderLoreLink}>
      {children}

      <Popover
        open={Boolean(cardLore)}
        anchorEl={card?.anchor}
        onClose={() => setCard(null)}
        anchorOrigin={{ vertical: "bottom", horizontal: "left" }}
        slotProps={{ paper: { sx: { width: 320, maxWidth: "92vw", p: 2 } } }}
      >
        {cardLore && (
          <Stack spacing={1.25}>
            <LoreEyebrow
              collectionName={collectionNames.get(cardLore.collectionId ?? "")}
            />
            <Typography fontWeight={800}>
              {gate.displayTitle(cardLore)}
            </Typography>
            {gate.isLocked(cardLore) ? (
              <ReaderSpoilerGate
                compact
                dependencies={spoilerDependencies(cardLore)}
                onNavigate={() => setCard(null)}
                onConfirm={() => gate.confirm(cardLore.id)}
              />
            ) : (
              <>
                <Typography variant="body2" color="text.secondary">
                  {cardLore.summary ||
                    plainTextFromMarkdown(cardLore.content).slice(
                      0,
                      SUMMARY_FALLBACK_LENGTH,
                    )}
                </Typography>
                <Stack direction="row" spacing={1}>
                  <Button
                    size="small"
                    variant="contained"
                    color="secondary"
                    onClick={() => openPanel(cardLore)}
                  >
                    看完整設定
                  </Button>
                  <Button
                    size="small"
                    component={RouterLink}
                    to={readerLorePath(basePath, cardLore.id)}
                    onClick={() => setCard(null)}
                  >
                    設定頁
                  </Button>
                </Stack>
              </>
            )}
          </Stack>
        )}
      </Popover>

      <Drawer
        anchor={isMobile ? "bottom" : "right"}
        open={Boolean(panelLore)}
        onClose={() => setPanelLoreId(null)}
        slotProps={{
          paper: {
            sx: {
              width: isMobile ? "100%" : 440,
              maxWidth: "100vw",
              maxHeight: isMobile ? "80vh" : undefined,
              borderTopLeftRadius: isMobile ? 16 : 0,
              borderTopRightRadius: isMobile ? 16 : 0,
            },
          },
        }}
      >
        {panelLore && (
          <LorePanel
            lore={panelLore}
            title={gate.displayTitle(panelLore)}
            collectionName={collectionNames.get(panelLore.collectionId ?? "")}
            pageHref={readerLorePath(basePath, panelLore.id)}
            preferences={preferences}
            locked={gate.isLocked(panelLore)}
            spoilerDependencies={spoilerDependencies(panelLore)}
            onConfirm={() => {
              gate.confirm(panelLore.id);
              onLoreRead(panelLore.id);
            }}
            onClose={() => setPanelLoreId(null)}
          />
        )}
      </Drawer>
    </StorytellerLoreLinkContext.Provider>
  );
}

function LoreEyebrow({ collectionName }: { collectionName?: string }) {
  return (
    <Stack
      direction="row"
      spacing={0.75}
      alignItems="center"
      sx={{ color: "secondary.main" }}
    >
      <AutoStoriesIcon sx={{ fontSize: 16 }} />
      <Typography variant="overline" fontWeight={800} lineHeight={1.4}>
        設定・{collectionName ?? "未歸類"}
      </Typography>
    </Stack>
  );
}

// 側邊面板：設定全文，排版吃讀者的閱讀設定；鎖住時先顯示確認卡片
function LorePanel({
  lore,
  title,
  collectionName,
  pageHref,
  preferences,
  locked,
  spoilerDependencies,
  onConfirm,
  onClose,
}: {
  lore: ReaderLore;
  title: string;
  collectionName?: string;
  pageHref: string;
  preferences: StorytellerTypographyPreferences;
  locked: boolean;
  spoilerDependencies: ReaderSpoilerDependency[];
  onConfirm: () => void;
  onClose: () => void;
}) {
  const footnoteIdPrefix = useId();
  const footnoteNumbering = computeFootnoteNumbering(lore.content);
  return (
    <Stack sx={{ height: "100%", minHeight: 0 }}>
      <Stack
        direction="row"
        alignItems="center"
        justifyContent="space-between"
        sx={{ px: 2, py: 1, borderBottom: 1, borderColor: "divider" }}
      >
        <LoreEyebrow collectionName={collectionName} />
        <IconButton aria-label="關閉設定面板" onClick={onClose}>
          <CloseIcon />
        </IconButton>
      </Stack>
      <Stack spacing={2} sx={{ p: 2, overflowY: "auto" }}>
        <Typography component="h2" variant="h5" fontWeight={800}>
          {title}
        </Typography>
        {!locked && lore.summary && (
          <Typography color="text.secondary">{lore.summary}</Typography>
        )}
        <Divider />
        {locked ? (
          <ReaderSpoilerGate
            dependencies={spoilerDependencies}
            onNavigate={onClose}
            onConfirm={onConfirm}
          />
        ) : (
          <ReaderTextFrame preferences={preferences}>
            <StoryContentLines
              content={lore.content}
              bookmarkedLines={NO_LINES}
              pendingLines={NO_LINES}
              bookmarkMode="none"
              bookmarkEditing={false}
              onToggleBookmark={noop}
              footnoteNumbering={footnoteNumbering}
              footnoteIdPrefix={footnoteIdPrefix}
            />
            <StorytellerFootnoteSection
              list={footnoteNumbering.list}
              idPrefix={footnoteIdPrefix}
            />
          </ReaderTextFrame>
        )}
        <Box>
          <Button
            size="small"
            component={RouterLink}
            to={pageHref}
            onClick={onClose}
            endIcon={<OpenInNewIcon fontSize="small" />}
          >
            在設定頁打開
          </Button>
        </Box>
      </Stack>
    </Stack>
  );
}
