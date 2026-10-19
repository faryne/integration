import CloseIcon from "@mui/icons-material/Close";
import HelpOutlineIcon from "@mui/icons-material/HelpOutline";
import {
  Box,
  Divider,
  Drawer,
  IconButton,
  Stack,
  Tooltip,
  Typography,
} from "@mui/material";
import { useState } from "react";
import { useTranslation } from "react-i18next";

import {
  BLOCK_KIND_BULLET_PREFIX,
  BLOCK_KIND_HR_PREFIX,
  BLOCK_KIND_NUMBER_CANONICAL_PREFIX,
  BLOCK_KIND_QUOTE_PREFIX,
  HEADING_LEVELS,
  MARK_SYNTAX_WHITELIST,
} from "./wysiwygCore/whitelist";

interface StorytellerWysiwygSyntaxDrawerProps {
  /** 跟 StorytellerWysiwygEditor 同一個 prop：哪些功能在目前頁面啟用，drawer 內容要
   * 照樣篩選，不要介紹使用者眼前根本不能用的功能。 */
  enabledFeatures?: Array<"footnote" | "comment" | "asset">;
}

interface SyntaxItem {
  label: string;
  syntax: string;
  description?: string;
}

function SyntaxList({ items }: { items: SyntaxItem[] }) {
  return (
    <>
      {items.map((item) => (
        <Stack key={item.label} spacing={0.5}>
          <Typography variant="body2" fontWeight={700}>
            {item.label}
          </Typography>
          {item.description && (
            <Typography variant="caption" color="text.secondary">
              {item.description}
            </Typography>
          )}
          <Box
            component="pre"
            sx={{
              bgcolor: "action.hover",
              borderRadius: 1,
              fontFamily:
                '"SFMono-Regular", Consolas, "Liberation Mono", monospace',
              fontSize: 13,
              m: 0,
              overflowX: "auto",
              p: 1,
              whiteSpace: "pre-wrap",
            }}
          >
            {item.syntax}
          </Box>
        </Stack>
      ))}
    </>
  );
}

/**
 * 說明本編輯器（wysiwygCore）自訂的精簡語法，跟 StorytellerMarkdownSyntaxDrawer 分開
 * 獨立實作——那個 drawer 說明的是標準 Markdown/GFM（remark-gfm），給 LoreEditor 舊版
 * 文字框／AI Agent 面板等地方用；這個編輯器走的是完全不同的自訂括號 marker 語法（見
 * wysiwygCore/whitelist.ts），沒有真正的 `[text](url)` 連結、程式碼區塊等 GFM
 * 語法（刪除線是有的，但用 `--` 不是 GFM 的 `~~`），混在一起說明只會誤導使用者去打根本
 * 不支援的語法。內容直接從 whitelist.ts
 * 匯入實際生效的前綴／delimiter 常數組字串，避免像先前 MCP 語法說明那樣，語法白名單更新
 * 了但這裡忘記跟著改。
 */
export function StorytellerWysiwygSyntaxDrawer({
  enabledFeatures,
}: StorytellerWysiwygSyntaxDrawerProps) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const isEnabled = (feature: "footnote" | "comment" | "asset") =>
    enabledFeatures === undefined || enabledFeatures.includes(feature);

  const markItems: SyntaxItem[] = MARK_SYNTAX_WHITELIST.map((rule) => ({
    label: t(`writer:editor.commands.${rule.markName}.label`),
    syntax: `${rule.canonicalDelimiter}${t("writer:editor.syntax.text")}${rule.canonicalDelimiter}`,
  }));

  const blockItems: SyntaxItem[] = [
    {
      label: t("writer:editor.syntax.heading"),
      syntax: Array.from(
        HEADING_LEVELS,
        (level) => `${"#".repeat(level)} ${t("writer:editor.syntax.heading")}`,
      ).join("\n"),
      description: t("writer:editor.syntax.headingHelp", {
        hashes: "#".repeat(HEADING_LEVELS.length),
        count: HEADING_LEVELS.length,
      }),
    },
    { label: t("writer:editor.commands.block-kind-quote.label"), syntax: `${BLOCK_KIND_QUOTE_PREFIX}${t("writer:editor.syntax.text")}` },
    { label: t("writer:editor.commands.block-kind-bullet.label"), syntax: `${BLOCK_KIND_BULLET_PREFIX}${t("writer:editor.syntax.item")}` },
    {
      label: t("writer:editor.commands.block-kind-number.label"),
      syntax: `${BLOCK_KIND_NUMBER_CANONICAL_PREFIX}${t("writer:editor.syntax.item")}`,
      description: t("writer:editor.syntax.numberHelp"),
    },
    {
      label: t("writer:editor.syntax.divider"),
      syntax: BLOCK_KIND_HR_PREFIX,
      description: t("writer:editor.syntax.dividerHelp"),
    },
  ];

  const menuOnlyItems: SyntaxItem[] = [
    {
      label: t("writer:editor.syntax.colors"),
      syntax: t("writer:editor.syntax.colorsPath"),
      description: t("writer:editor.syntax.colorsHelp"),
    },
    {
      label: t("writer:editor.syntax.link"),
      syntax: t("writer:editor.syntax.linkPath"),
      description: t("writer:editor.syntax.linkHelp"),
    },
    ...(isEnabled("footnote")
      ? [
          {
            label: t("writer:editor.syntax.footnote"),
            syntax: t("writer:editor.syntax.footnotePath"),
            description: t("writer:editor.syntax.footnoteHelp"),
          },
        ]
      : []),
    ...(isEnabled("comment")
      ? [
          {
            label: t("writer:editor.syntax.comment"),
            syntax: t("writer:editor.syntax.commentPath"),
            description: t("writer:editor.syntax.commentHelp"),
          },
        ]
      : []),
    ...(isEnabled("asset")
      ? [
          {
            label: t("writer:editor.commands.insert-image.label"),
            syntax: t("writer:editor.syntax.imagePath"),
            description: t("writer:editor.syntax.imageHelp"),
          },
        ]
      : []),
  ];

  return (
    <>
      <Tooltip title={t("writer:editor.syntax.open")}>
        <IconButton
          aria-label={t("writer:editor.syntax.open")}
          size="small"
          onClick={() => setOpen(true)}
        >
          <HelpOutlineIcon fontSize="small" />
        </IconButton>
      </Tooltip>
      <Drawer anchor="right" open={open} onClose={() => setOpen(false)}>
        <Box sx={{ width: { xs: 320, sm: 420 }, maxWidth: "92vw", p: 2 }}>
          <Stack spacing={2}>
            <Stack
              direction="row"
              spacing={1}
              alignItems="center"
              justifyContent="space-between"
            >
              <Typography variant="h6" fontWeight={800}>
                {t("writer:editor.syntax.title")}
              </Typography>
              <IconButton aria-label={t("writer:common.close")} onClick={() => setOpen(false)}>
                <CloseIcon />
              </IconButton>
            </Stack>
            <Typography variant="body2" color="text.secondary">
              {t("writer:editor.syntax.description")}
            </Typography>
            <Divider />
            <Stack spacing={1.25}>
              <Typography fontWeight={800}>{t("writer:editor.syntax.textStyles")}</Typography>
              <SyntaxList items={markItems} />
            </Stack>
            <Divider />
            <Stack spacing={1.25}>
              <Typography fontWeight={800}>{t("writer:editor.syntax.paragraphStyles")}</Typography>
              <SyntaxList items={blockItems} />
            </Stack>
            <Divider />
            <Stack spacing={1.25}>
              <Typography fontWeight={800}>{t("writer:editor.syntax.menuOnly")}</Typography>
              <SyntaxList items={menuOnlyItems} />
            </Stack>
          </Stack>
        </Box>
      </Drawer>
    </>
  );
}
