import AutoStoriesIcon from "@mui/icons-material/AutoStories";
import { Box, Divider, Paper, Stack, Typography } from "@mui/material";
import { useEffect, useId, type Ref } from "react";
import { ContentMetaHeader } from "@/pages/storyteller/ReaderContentHeader.tsx";
import type { ReaderLore } from "@/pages/storyteller/readerModel.ts";
import {
  ReaderTextFrame,
  StoryContentLines,
} from "@/pages/storyteller/ReaderStoryContent.tsx";
import {
  ReaderSpoilerGate,
  type ReaderSpoilerDependency,
} from "@/pages/storyteller/ReaderSpoilerGate.tsx";
import { SPOILER_LORE_TITLE } from "@/pages/storyteller/useLoreSpoilerGate.ts";
import { StorytellerFootnoteSection } from "@/pages/storyteller/StorytellerWysiwygMarkdown.tsx";
import type { StorytellerTypographyPreferences } from "@/pages/storyteller/useStorytellerTypographyPreferences.ts";
import { computeFootnoteNumbering } from "@/pages/storyteller/wysiwygCore/parser.ts";

// 設定不能加閱讀書籤（書籤只給故事用），這兩個空集合給 StoryContentLines 當固定值
const NO_LINES = new Set<number>();
const noop = () => undefined;

// 閱讀頁的單則設定：排版沿用故事本文（同一套閱讀設定），但頂端標明「設定・設定集」，
// 讓讀者知道自己正在看設定而不是故事。外框的 ref 交給 Reader 算閱讀進度（跟故事同一套公式）。
export function ReaderLorePage({
  lore,
  collectionName,
  bodyRef,
  titleRef,
  preferences,
  gate,
}: {
  lore: ReaderLore;
  // 劇透設定還沒解鎖時才會給：正文換成確認卡片，標題與摘要也先不顯示
  gate?: {
    dependencies: ReaderSpoilerDependency[];
    onConfirm: () => void;
  };
  collectionName?: string;
  bodyRef: Ref<HTMLDivElement>;
  titleRef?: Ref<HTMLHeadingElement>;
  preferences: StorytellerTypographyPreferences;
}) {
  const footnoteIdPrefix = useId();
  const footnoteNumbering = computeFootnoteNumbering(lore.content);

  // 換到另一則設定時回到頁首（設定頁之間用上一則／下一則切換，捲動位置不該沿用）
  useEffect(() => {
    window.scrollTo({ top: 0 });
  }, [lore.id]);

  return (
    <Paper
      ref={bodyRef}
      variant="outlined"
      sx={{
        p: { xs: 2, sm: 4, md: 6 },
        borderRadius: 0,
        borderColor: "divider",
        bgcolor: "background.paper",
        backgroundImage: "none",
        maxWidth: 960,
        width: "100%",
        boxSizing: "border-box",
        alignSelf: "center",
        boxShadow:
          "18px 18px 0 color-mix(in srgb, var(--storyteller-accent-main) 5%, transparent)",
      }}
    >
      <Stack
        spacing={2}
        sx={{ width: "100%", maxWidth: preferences.measure, mx: "auto" }}
      >
        <Stack
          direction="row"
          spacing={0.75}
          alignItems="center"
          sx={{ color: "secondary.main" }}
        >
          <AutoStoriesIcon sx={{ fontSize: 18 }} />
          <Typography variant="overline" fontWeight={800} lineHeight={1.4}>
            設定・{collectionName ?? "未歸類"}
          </Typography>
        </Stack>
        <ContentMetaHeader
          title={gate ? SPOILER_LORE_TITLE : lore.title}
          titleRef={titleRef}
          summary={gate ? undefined : lore.summary}
          updatedAt={lore.updatedAt}
        />
        <Divider />
        {gate ? (
          <ReaderSpoilerGate
            dependencies={gate.dependencies}
            onConfirm={gate.onConfirm}
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
      </Stack>
      <Box
        aria-hidden="true"
        data-reader-bottom-spacer
        sx={{ height: "calc(88px + env(safe-area-inset-bottom))" }}
      />
    </Paper>
  );
}
