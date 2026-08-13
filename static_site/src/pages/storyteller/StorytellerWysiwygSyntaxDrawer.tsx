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

import {
  BLOCK_KIND_BULLET_PREFIX,
  BLOCK_KIND_HR_PREFIX,
  BLOCK_KIND_NUMBER_CANONICAL_PREFIX,
  BLOCK_KIND_QUOTE_PREFIX,
  BLOCK_KIND_TABLE_ROW_PREFIX,
  HEADING_LEVELS,
  MARK_SYNTAX_WHITELIST,
  type MarkName,
} from "./wysiwygCore/whitelist";

interface StorytellerWysiwygSyntaxDrawerProps {
  /** 跟 StorytellerWysiwygEditor 同一個 prop：哪些功能有出現在工具列上，drawer 內容要
   * 照樣篩選，不要介紹使用者眼前工具列根本沒有的按鈕。 */
  enabledFeatures?: Array<"footnote" | "comment" | "asset">;
}

const MARK_LABEL: Record<MarkName, string> = {
  bold: "粗體",
  italic: "斜體",
  underline: "底線",
  subscript: "下標",
  superscript: "上標",
  strike: "刪除線",
};

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
  const [open, setOpen] = useState(false);
  const isEnabled = (feature: "footnote" | "comment" | "asset") =>
    enabledFeatures === undefined || enabledFeatures.includes(feature);

  const markItems: SyntaxItem[] = MARK_SYNTAX_WHITELIST.map((rule) => ({
    label: MARK_LABEL[rule.markName],
    syntax: `${rule.canonicalDelimiter}文字${rule.canonicalDelimiter}`,
  }));

  const blockItems: SyntaxItem[] = [
    {
      label: "標題",
      syntax: Array.from(
        HEADING_LEVELS,
        (level) => `${"#".repeat(level)} 標題`,
      ).join("\n"),
      description: `行首打 # 到 ${"#".repeat(HEADING_LEVELS.length)}（1~${HEADING_LEVELS.length} 層），後面接一個空白。`,
    },
    { label: "引用", syntax: `${BLOCK_KIND_QUOTE_PREFIX}文字` },
    { label: "無序清單", syntax: `${BLOCK_KIND_BULLET_PREFIX}項目` },
    {
      label: "有序清單",
      syntax: `${BLOCK_KIND_NUMBER_CANONICAL_PREFIX}項目`,
      description: "自動編號，打的數字不影響實際顯示的編號。",
    },
    {
      label: "分隔線",
      syntax: BLOCK_KIND_HR_PREFIX,
      description: "獨立一行打三個減號，會自動變成分隔線並換到下一行。",
    },
    {
      label: "表格列",
      syntax:
        `${BLOCK_KIND_TABLE_ROW_PREFIX} A ${BLOCK_KIND_TABLE_ROW_PREFIX} B ${BLOCK_KIND_TABLE_ROW_PREFIX} CC ${BLOCK_KIND_TABLE_ROW_PREFIX}\n` +
        `${BLOCK_KIND_TABLE_ROW_PREFIX}--${BLOCK_KIND_TABLE_ROW_PREFIX}--${BLOCK_KIND_TABLE_ROW_PREFIX}--${BLOCK_KIND_TABLE_ROW_PREFIX}\n` +
        `${BLOCK_KIND_TABLE_ROW_PREFIX} 1 ${BLOCK_KIND_TABLE_ROW_PREFIX} 2 ${BLOCK_KIND_TABLE_ROW_PREFIX} 3 ${BLOCK_KIND_TABLE_ROW_PREFIX}`,
      description:
        "每一行是一個表格列，自己打 | 分隔欄位；連續幾行都是表格列會合併成一個表格。第二列打全是 - 的分隔列（比照標準 markdown 表頭寫法）會把第一列變成粗體表頭，分隔列本身不會顯示出來；不打分隔列的話所有列都當一般資料列。欄位內只支援粗體/斜體/底線/上下標，不支援顏色/連結/腳注/註解。",
    },
  ];

  const toolbarOnlyItems: SyntaxItem[] = [
    {
      label: "文字顏色／背景色",
      syntax: "選取文字 → 工具列色盤按鈕",
      description: "沒有打字捷徑，固定色盤可選。",
    },
    {
      label: "連結",
      syntax: "選取文字 → 工具列連結按鈕",
      description: "只接受 http(s) 開頭的網址。",
    },
    ...(isEnabled("footnote")
      ? [
          {
            label: "腳注",
            syntax: "選取文字 → 工具列腳注按鈕",
            description: "讀者在閱讀頁看得到，內容顯示在文章最尾端。",
          },
        ]
      : []),
    ...(isEnabled("comment")
      ? [
          {
            label: "註解",
            syntax: "選取文字 → 工具列註解按鈕",
            description: "只有作者自己看得到，讀者端完全不會出現。",
          },
        ]
      : []),
    ...(isEnabled("asset")
      ? [
          {
            label: "插入圖片",
            syntax: "工具列插入圖片按鈕",
            description: "從專案的資產集裡選圖插入。",
          },
        ]
      : []),
  ];

  return (
    <>
      <Tooltip title="支援的語法">
        <IconButton
          aria-label="支援的語法"
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
                編輯器支援的語法
              </Typography>
              <IconButton aria-label="關閉" onClick={() => setOpen(false)}>
                <CloseIcon />
              </IconButton>
            </Stack>
            <Typography variant="body2" color="text.secondary">
              這是本編輯器自訂的精簡語法，不是完整
              Markdown／GFM——打下面的符號會自動轉換
              成對應格式；顏色、連結等則要透過工具列按鈕套用，沒有打字捷徑。
            </Typography>
            <Divider />
            <Stack spacing={1.25}>
              <Typography fontWeight={800}>文字樣式</Typography>
              <SyntaxList items={markItems} />
            </Stack>
            <Divider />
            <Stack spacing={1.25}>
              <Typography fontWeight={800}>段落格式</Typography>
              <SyntaxList items={blockItems} />
            </Stack>
            <Divider />
            <Stack spacing={1.25}>
              <Typography fontWeight={800}>只能透過工具列套用</Typography>
              <SyntaxList items={toolbarOnlyItems} />
            </Stack>
          </Stack>
        </Box>
      </Drawer>
    </>
  );
}
