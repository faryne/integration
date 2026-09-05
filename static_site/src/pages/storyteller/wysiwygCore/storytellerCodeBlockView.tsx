import CheckIcon from "@mui/icons-material/Check";
import ContentCopyIcon from "@mui/icons-material/ContentCopy";
import UnfoldLessIcon from "@mui/icons-material/UnfoldLess";
import UnfoldMoreIcon from "@mui/icons-material/UnfoldMore";
import {
  Autocomplete,
  Box,
  Button,
  IconButton,
  TextField,
  Tooltip,
} from "@mui/material";
import type { Theme } from "@mui/material/styles";
import { useEffect, useMemo, useState, type ReactNode } from "react";

import {
  STORYTELLER_CODE_BLOCK_LANGUAGES as STORYTELLER_CODE_BLOCK_LANGUAGE_OPTIONS,
  normalizeStorytellerCodeBlockLanguage,
} from "./storytellerCodeBlockHighlight";

export { STORYTELLER_CODE_BLOCK_LANGUAGES } from "./storytellerCodeBlockHighlight";

// 超過這個行數就預設收縮、底部出現「展開」按鈕；行數在這之內完全不做收縮、
// 也不出現按鈕——短的程式碼片段沒有「先收起來」的必要，平白多一顆按鈕反而
// 干擾閱讀。20 行大致是一般螢幕不用捲動就看得完的量，抓個常見的預設值。
const STORYTELLER_CODE_BLOCK_COLLAPSE_LINE_THRESHOLD = 20;
// 跟 STORYTELLER_CODE_BLOCK_SX 的 pre 樣式（fontSize 0.875rem／lineHeight 1.6）
// 對應：一行的實際高度是 fontSize * lineHeight，收縮時 max-height 用同一組數字
// 算，不要另外寫死一個跟樣式脫勾的高度。
const STORYTELLER_CODE_BLOCK_LINE_HEIGHT_EM = 0.875 * 1.6;

export interface StorytellerCodeBlockAction {
  icon: ReactNode;
  label: string;
  onClick: (content: string) => void | Promise<void>;
}

export const STORYTELLER_CODE_BLOCK_SX = {
  "& .storyteller-code-block": {
    my: "0.5em",
    border: "1px solid",
    borderColor: "divider",
    borderRadius: 1,
    bgcolor: "action.hover",
    overflow: "hidden",
  },
  "& .ProseMirror-selectednode .storyteller-code-block": {
    outline: "3px solid var(--storyteller-selection, #e6bd76)",
    outlineOffset: 3,
  },
  "& .storyteller-code-block-header": {
    minHeight: 38,
    px: 1,
    py: 0.5,
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 1,
    borderBottom: "1px solid",
    borderColor: "divider",
    bgcolor: "background.paper",
  },
  "& .storyteller-code-block-language": {
    minWidth: 0,
    color: "text.secondary",
    fontFamily: "monospace",
    fontSize: "0.75rem",
  },
  "& .storyteller-code-block-actions": {
    display: "flex",
    alignItems: "center",
    gap: 0.5,
    flexShrink: 0,
  },
  "& pre.storyteller-code-block-pre": {
    m: 0,
    p: 1.5,
    overflowX: "auto",
    fontFamily:
      'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", monospace',
    fontSize: "0.875rem",
    lineHeight: 1.6,
    whiteSpace: "pre",
    position: "relative",
  },
  "& code.storyteller-code-block-content": {
    fontFamily: "inherit",
    whiteSpace: "pre",
  },
  "& .storyteller-code-block-content .hljs-keyword": {
    color: (theme: Theme) =>
      theme.palette.mode === "dark" ? "#ff7b72" : "#cf222e",
  },
  "& .storyteller-code-block-content .hljs-string, & .storyteller-code-block-content .hljs-regexp":
    {
      color: (theme: Theme) =>
        theme.palette.mode === "dark" ? "#a5d6ff" : "#0a3069",
    },
  "& .storyteller-code-block-content .hljs-comment": {
    color: (theme: Theme) =>
      theme.palette.mode === "dark" ? "#8b949e" : "#6e7781",
  },
  "& .storyteller-code-block-content .hljs-number, & .storyteller-code-block-content .hljs-literal":
    {
      color: (theme: Theme) =>
        theme.palette.mode === "dark" ? "#79c0ff" : "#0550ae",
    },
  "& .storyteller-code-block-content .hljs-title, & .storyteller-code-block-content .hljs-title.function_, & .storyteller-code-block-content .hljs-title.class_":
    {
      color: (theme: Theme) =>
        theme.palette.mode === "dark" ? "#d2a8ff" : "#8250df",
    },
  "& .storyteller-code-block-content .hljs-attr, & .storyteller-code-block-content .hljs-attribute, & .storyteller-code-block-content .hljs-variable, & .storyteller-code-block-content .hljs-template-variable":
    {
      color: (theme: Theme) =>
        theme.palette.mode === "dark" ? "#ffa657" : "#953800",
    },
  "& .storyteller-code-block-content .hljs-built_in, & .storyteller-code-block-content .hljs-type, & .storyteller-code-block-content .hljs-class .hljs-title":
    {
      color: (theme: Theme) =>
        theme.palette.mode === "dark" ? "#ffa657" : "#953800",
    },
  "& .storyteller-code-block-content .hljs-meta, & .storyteller-code-block-content .hljs-doctag":
    {
      color: (theme: Theme) =>
        theme.palette.mode === "dark" ? "#8b949e" : "#6e7781",
    },
  "& .storyteller-code-block-content .hljs-tag": {
    color: (theme: Theme) =>
      theme.palette.mode === "dark" ? "#7ee787" : "#116329",
  },
  "& .storyteller-code-block-content .hljs-name, & .storyteller-code-block-content .hljs-selector-tag, & .storyteller-code-block-content .hljs-selector-id, & .storyteller-code-block-content .hljs-selector-class":
    {
      color: (theme: Theme) =>
        theme.palette.mode === "dark" ? "#7ee787" : "#116329",
    },
  "& .storyteller-code-block-content .hljs-section": {
    color: (theme: Theme) =>
      theme.palette.mode === "dark" ? "#1f6feb" : "#0550ae",
  },
  "& .storyteller-code-block-content .hljs-bullet, & .storyteller-code-block-content .hljs-symbol":
    {
      color: (theme: Theme) =>
        theme.palette.mode === "dark" ? "#f2cc60" : "#3b2300",
    },
  "& .storyteller-code-block-content .hljs-link": {
    color: (theme: Theme) =>
      theme.palette.mode === "dark" ? "#a5d6ff" : "#0a3069",
    textDecoration: "underline",
  },
  "& .storyteller-code-block-content .hljs-deletion": {
    color: (theme: Theme) =>
      theme.palette.mode === "dark" ? "#ffdcd7" : "#82071e",
    backgroundColor: (theme: Theme) =>
      theme.palette.mode === "dark" ? "#67060c" : "#ffebe9",
  },
  "& .storyteller-code-block-content .hljs-addition": {
    color: (theme: Theme) =>
      theme.palette.mode === "dark" ? "#aff5b4" : "#116329",
    backgroundColor: (theme: Theme) =>
      theme.palette.mode === "dark" ? "#033a16" : "#dafbe1",
  },
  "& .storyteller-code-block-collapse-fade": {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    height: 48,
    pointerEvents: "none",
    background: (theme: Theme) =>
      `linear-gradient(to bottom, transparent, ${theme.palette.action.hover})`,
  },
  "& .storyteller-code-block-toggle": {
    display: "flex",
    justifyContent: "center",
    borderTop: "1px solid",
    borderColor: "divider",
  },
  "& .storyteller-code-block-toggle button": {
    borderRadius: 0,
    py: 0.5,
    textTransform: "none",
    fontSize: "0.75rem",
    color: "text.secondary",
  },
} as const;

export const DEFAULT_STORYTELLER_CODE_BLOCK_ACTIONS: StorytellerCodeBlockAction[] =
  [
    {
      icon: <ContentCopyIcon fontSize="inherit" />,
      label: "複製",
      onClick: (content) => navigator.clipboard.writeText(content),
    },
  ];

interface StorytellerCodeBlockFrameProps {
  markerId?: string | null;
  language?: string | null;
  content: string;
  editableLanguage?: boolean;
  onLanguageChange?: (language: string | null) => void;
  actions?: StorytellerCodeBlockAction[];
  children: ReactNode;
}

export function StorytellerCodeBlockFrame({
  markerId,
  language,
  content,
  editableLanguage = false,
  onLanguageChange,
  actions = DEFAULT_STORYTELLER_CODE_BLOCK_ACTIONS,
  children,
}: StorytellerCodeBlockFrameProps) {
  const [succeededAction, setSucceededAction] = useState<number | null>(null);
  const normalizedLanguage = (language ?? "").trim();
  const highlightedLanguage =
    normalizeStorytellerCodeBlockLanguage(normalizedLanguage);
  const codeClassName = highlightedLanguage
    ? `language-${highlightedLanguage}`
    : normalizedLanguage
      ? `language-${normalizedLanguage}`
      : undefined;
  const languageOptions = useMemo(
    () => [...STORYTELLER_CODE_BLOCK_LANGUAGE_OPTIONS],
    [],
  );

  const lineCount = useMemo(() => content.split("\n").length, [content]);
  const isCollapsible =
    lineCount > STORYTELLER_CODE_BLOCK_COLLAPSE_LINE_THRESHOLD;
  // 預設收縮（超過門檻才會是 true），使用者展開後就記住這個 session 的選擇；
  // 行數在門檻內的話 isCollapsible 一路是 false，底下渲染完全不會出現按鈕，
  // 這個 state 也不會被用到。
  const [collapsed, setCollapsed] = useState(isCollapsible);

  useEffect(() => {
    if (succeededAction === null) return undefined;
    const timer = window.setTimeout(() => setSucceededAction(null), 1200);
    return () => window.clearTimeout(timer);
  }, [succeededAction]);

  return (
    <Box
      className="storyteller-code-block"
      data-marker-id={markerId || undefined}
    >
      <Box className="storyteller-code-block-header" contentEditable={false}>
        {editableLanguage ? (
          <Autocomplete
            freeSolo
            size="small"
            options={languageOptions}
            value={normalizedLanguage}
            inputValue={normalizedLanguage}
            onChange={(_event, value) =>
              onLanguageChange?.((value ?? "").trim() || null)
            }
            onInputChange={(_event, value) =>
              onLanguageChange?.(value.trim() || null)
            }
            renderInput={(params) => (
              <TextField
                {...params}
                label="語言"
                variant="standard"
                placeholder="language"
              />
            )}
            sx={{ width: 180, maxWidth: "45%" }}
          />
        ) : (
          <Box component="span" className="storyteller-code-block-language">
            {normalizedLanguage}
          </Box>
        )}
        <Box className="storyteller-code-block-actions">
          {actions.map((action, index) => (
            <Tooltip key={`${action.label}-${index}`} title={action.label}>
              <IconButton
                size="small"
                aria-label={action.label}
                onClick={async () => {
                  // action.onClick 常見的實作是 navigator.clipboard.writeText，
                  // 在某些瀏覽器/情境下（沒有 focus、權限被拒）會 reject——沒接住
                  // 的話變成 unhandled rejection，使用者也看不到任何回饋，直接
                  // 靜默失敗。失敗時就不顯示打勾，也不用另外跳錯誤訊息。
                  try {
                    await action.onClick(content);
                    setSucceededAction(index);
                  } catch {
                    // 靜默失敗：不顯示打勾即可讓使用者知道沒成功。
                  }
                }}
              >
                {succeededAction === index ? (
                  <CheckIcon fontSize="inherit" color="success" />
                ) : (
                  action.icon
                )}
              </IconButton>
            </Tooltip>
          ))}
        </Box>
      </Box>
      <Box
        component="pre"
        className="storyteller-code-block-pre"
        sx={
          collapsed
            ? {
                // 高度＝N 行的實際高度（em，字級相對）＋上下 padding（px，跟
                // 上面 STORYTELLER_CODE_BLOCK_SX 的 pre padding 用同一個
                // theme.spacing(1.5)＝12px，兩種單位混用故意用 calc() 分開算，
                // 不要為了湊同一個單位硬把其中一個換算成近似值。
                maxHeight: `calc(${
                  STORYTELLER_CODE_BLOCK_COLLAPSE_LINE_THRESHOLD *
                  STORYTELLER_CODE_BLOCK_LINE_HEIGHT_EM
                }em + 24px)`,
                overflowY: "hidden",
              }
            : undefined
        }
      >
        <Box
          component="code"
          className={["storyteller-code-block-content", codeClassName]
            .filter(Boolean)
            .join(" ")}
        >
          {children}
        </Box>
        {collapsed && <Box className="storyteller-code-block-collapse-fade" />}
      </Box>
      {isCollapsible && (
        <Box className="storyteller-code-block-toggle" contentEditable={false}>
          <Button
            size="small"
            fullWidth
            startIcon={
              collapsed ? (
                <UnfoldMoreIcon fontSize="inherit" />
              ) : (
                <UnfoldLessIcon fontSize="inherit" />
              )
            }
            onClick={() => setCollapsed((prev) => !prev)}
          >
            {collapsed ? `展開全部（共 ${lineCount} 行）` : "收合"}
          </Button>
        </Box>
      )}
    </Box>
  );
}
