import ArrowDownwardIcon from "@mui/icons-material/ArrowDownward";
import ArrowUpwardIcon from "@mui/icons-material/ArrowUpward";
import ChevronRightIcon from "@mui/icons-material/ChevronRight";
import CloseIcon from "@mui/icons-material/Close";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import {
  Box,
  Button,
  IconButton,
  InputBase,
  Paper,
  Stack,
  Tooltip,
  Typography,
} from "@mui/material";
import type { Editor } from "@tiptap/core";
import { useEditorState } from "@tiptap/react";
import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import { useTranslation } from "react-i18next";
import {
  clearFind,
  getFindState,
  replaceAllMatches,
  replaceCurrentMatch,
  setFindQuery,
  stepFindMatch,
} from "./wysiwygCore/findReplace";

const FIELD_SX = {
  flex: 1,
  minWidth: 0,
  height: 30,
  px: 1,
  fontSize: 14,
  border: 1,
  borderColor: "divider",
  borderRadius: 1,
  "&.Mui-focused": { borderColor: "primary.main" },
} as const;

// 單篇尋找／取代的浮動列（編輯區右上，不跟正文一起捲動）。比對與取代邏輯在 wysiwygCore/findReplace.ts。
// 呼叫端每次開啟換 key：initialQuery（有選取文字時帶進來）只在掛載時套用一次。
export function StorytellerFindBar({
  editor,
  initialQuery,
  onClose,
}: {
  editor: Editor;
  initialQuery: string;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const [query, setQuery] = useState(initialQuery);
  const [caseSensitive, setCaseSensitive] = useState(false);
  const [replaceOpen, setReplaceOpen] = useState(false);
  const [replacement, setReplacement] = useState("");
  // 全部取代之後在計數的位置顯示取代了幾處，改查詢字就收掉
  const [replacedCount, setReplacedCount] = useState<number | null>(null);
  const queryRef = useRef<HTMLInputElement>(null);
  const { total, current } = useEditorState({
    editor,
    selector: ({ editor: current }) => {
      const state = getFindState(current);
      return { total: state.matches.length, current: state.current };
    },
  });
  const canReplace = editor.isEditable;

  useEffect(() => {
    setFindQuery(editor, query, caseSensitive);
  }, [editor, query, caseSensitive]);
  // 關掉（含換文件卸載）時清掉高亮
  useEffect(
    () => () => {
      if (!editor.isDestroyed) clearFind(editor);
    },
    [editor],
  );
  useEffect(() => {
    queryRef.current?.select();
  }, []);

  const close = () => {
    onClose();
    editor.commands.focus();
  };
  const onQueryKeyDown = (event: KeyboardEvent) => {
    if (event.key === "Escape") return close();
    if (event.key !== "Enter" || event.nativeEvent.isComposing) return;
    event.preventDefault();
    stepFindMatch(editor, event.shiftKey ? -1 : 1);
  };
  const onReplaceKeyDown = (event: KeyboardEvent) => {
    if (event.key === "Escape") return close();
    if (event.key !== "Enter" || event.nativeEvent.isComposing) return;
    event.preventDefault();
    replaceCurrentMatch(editor, replacement);
  };

  const countLabel =
    replacedCount !== null
      ? t("writer:editor.find.replaced", { count: replacedCount })
      : !query
        ? ""
        : total
          ? `${current + 1} / ${total}`
          : t("writer:editor.find.noMatch");

  return (
    <Paper
      elevation={8}
      sx={{
        position: "absolute",
        top: 8,
        right: 16,
        zIndex: 5,
        width: 440,
        maxWidth: "calc(100% - 32px)",
        p: 1,
      }}
    >
      <Stack direction="row" alignItems="center" spacing={0.5}>
        {canReplace ? (
          <IconButton
            size="small"
            aria-label={t(replaceOpen ? "writer:editor.find.collapseReplace" : "writer:editor.find.expandReplace")}
            onClick={() => setReplaceOpen((open) => !open)}
          >
            {replaceOpen ? (
              <ExpandMoreIcon fontSize="small" />
            ) : (
              <ChevronRightIcon fontSize="small" />
            )}
          </IconButton>
        ) : null}
        <InputBase
          inputRef={queryRef}
          autoFocus
          placeholder={t("writer:editor.find.search")}
          value={query}
          onChange={(event) => {
            setQuery(event.target.value);
            setReplacedCount(null);
          }}
          onKeyDown={onQueryKeyDown}
          sx={FIELD_SX}
          endAdornment={
            <Tooltip title={t("writer:editor.find.caseSensitive")}>
              <Box
                component="button"
                type="button"
                aria-pressed={caseSensitive}
                onClick={() => setCaseSensitive((value) => !value)}
                sx={{
                  px: 0.5,
                  fontSize: 11,
                  lineHeight: 1.6,
                  borderRadius: 0.5,
                  cursor: "pointer",
                  bgcolor: "transparent",
                  border: 1,
                  borderColor: caseSensitive ? "primary.main" : "transparent",
                  color: caseSensitive ? "primary.main" : "text.secondary",
                }}
              >
                Aa
              </Box>
            </Tooltip>
          }
        />
        <Typography
          variant="caption"
          sx={{
            minWidth: 64,
            textAlign: "right",
            whiteSpace: "nowrap",
            color:
              query && !total && replacedCount === null
                ? "error.main"
                : "text.secondary",
          }}
        >
          {countLabel}
        </Typography>
        <IconButton
          size="small"
          aria-label={t("writer:editor.find.previous")}
          disabled={total < 2}
          onClick={() => stepFindMatch(editor, -1)}
        >
          <ArrowUpwardIcon fontSize="small" />
        </IconButton>
        <IconButton
          size="small"
          aria-label={t("writer:editor.find.next")}
          disabled={total < 2}
          onClick={() => stepFindMatch(editor, 1)}
        >
          <ArrowDownwardIcon fontSize="small" />
        </IconButton>
        <IconButton size="small" aria-label={t("writer:common.close")} onClick={close}>
          <CloseIcon fontSize="small" />
        </IconButton>
      </Stack>
      {canReplace && replaceOpen && (
        <Stack
          direction="row"
          alignItems="center"
          spacing={0.5}
          sx={{ mt: 0.75, pl: 4.5 }}
        >
          <InputBase
            placeholder={t("writer:editor.find.replaceWith")}
            value={replacement}
            onChange={(event) => setReplacement(event.target.value)}
            onKeyDown={onReplaceKeyDown}
            sx={FIELD_SX}
          />
          <Button
            size="small"
            variant="outlined"
            disabled={!total}
            onClick={() => replaceCurrentMatch(editor, replacement)}
          >
            {t("writer:editor.find.replace")}
          </Button>
          <Button
            size="small"
            variant="outlined"
            disabled={!total}
            onClick={() =>
              setReplacedCount(replaceAllMatches(editor, replacement))
            }
          >
            {t("writer:editor.find.replaceAll")}
          </Button>
        </Stack>
      )}
    </Paper>
  );
}
