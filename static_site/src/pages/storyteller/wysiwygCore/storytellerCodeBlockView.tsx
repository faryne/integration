import CheckIcon from "@mui/icons-material/Check";
import ContentCopyIcon from "@mui/icons-material/ContentCopy";
import {
  Autocomplete,
  Box,
  IconButton,
  TextField,
  Tooltip,
} from "@mui/material";
import { useEffect, useMemo, useState, type ReactNode } from "react";

export const STORYTELLER_CODE_BLOCK_LANGUAGES = [
  "go",
  "typescript",
  "javascript",
  "python",
  "json",
  "bash",
  "yaml",
  "sql",
  "html",
  "css",
] as const;

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
  },
  "& code.storyteller-code-block-content": {
    fontFamily: "inherit",
    whiteSpace: "pre",
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
  const codeClassName = normalizedLanguage
    ? `language-${normalizedLanguage}`
    : undefined;
  const languageOptions = useMemo(
    () => [...STORYTELLER_CODE_BLOCK_LANGUAGES],
    [],
  );

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
      <Box component="pre" className="storyteller-code-block-pre">
        <Box
          component="code"
          className={["storyteller-code-block-content", codeClassName]
            .filter(Boolean)
            .join(" ")}
        >
          {children}
        </Box>
      </Box>
    </Box>
  );
}
