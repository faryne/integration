import CloseIcon from "@mui/icons-material/Close";
import FormatQuoteIcon from "@mui/icons-material/FormatQuote";
import { Box, Button, Chip, IconButton, Paper, Stack, TextField, Tooltip, Typography } from "@mui/material";
import { useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  currentLoreMentionQuery,
  currentStoryMentionQuery,
  insertLoreMention,
  insertStoryMention,
} from "@steamloom-web/pages/storyteller/storytellerAgentEditing.ts";
import {
  parseStorytellerAgentReferenceTokens,
  type StorytellerAgentReferenceKind,
} from "@steamloom-web/pages/storyteller/storytellerAgentReferences.ts";
import { StorytellerPromptHighlightOverlay } from "@steamloom-web/pages/storyteller/StorytellerPromptHighlightOverlay.tsx";
import type { DocumentItem, Workspace } from "@writer/lib/backend.ts";
import { workspaceDocuments } from "@writer/pages/workspace/workspaceTree.ts";
import { promptReferencePreview, type PromptReference } from "@writer/pages/workspace/promptReferences.ts";

interface PromptSelection {
  start: number;
  end: number;
}

interface ResolvedReference {
  token: string;
  kind: StorytellerAgentReferenceKind;
  title: string;
}

export function AgentPromptEditor({
  workspace,
  value,
  disabled,
  references,
  onChange,
  onRemoveReference,
  onSubmit,
}: {
  workspace: Workspace;
  value: string;
  disabled: boolean;
  references: PromptReference[];
  onChange: (value: string) => void;
  onRemoveReference: (id: string) => void;
  onSubmit: () => void;
}) {
  const { t } = useTranslation();
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  // composition state 必須同步寫進 ref：React state 更新晚於原生 keydown，單靠 state
  // 會讓注音／日文輸入法用 Enter 選字時，偶發被當成送出。
  const compositionRef = useRef(false);
  const compositionEndedAtRef = useRef(Number.NEGATIVE_INFINITY);
  const [selection, setSelection] = useState<PromptSelection>({ start: 0, end: 0 });
  const [composing, setComposing] = useState(false);
  const [focused, setFocused] = useState(false);
  const stories = useMemo(() => workspaceDocuments(workspace, "story"), [workspace]);
  const lores = useMemo(() => workspaceDocuments(workspace, "lore"), [workspace]);
  const storyQuery = currentStoryMentionQuery(value, selection.start, selection.end);
  const loreQuery = currentLoreMentionQuery(value, selection.start, selection.end);
  const suggestions = useMemo(
    () => [
      ...filterSuggestions(stories, storyQuery).map((item) => ({ ...item, kind: "story" as const })),
      ...filterSuggestions(lores, loreQuery).map((item) => ({ ...item, kind: "lore" as const })),
    ].slice(0, 6),
    [loreQuery, lores, stories, storyQuery],
  );
  const namedReferences = useMemo(() => resolveReferences(value, stories, lores), [lores, stories, value]);

  const syncSelection = (target: HTMLInputElement | HTMLTextAreaElement | null = textareaRef.current) => {
    if (!target) return;
    setSelection({
      start: target.selectionStart ?? target.value.length,
      end: target.selectionEnd ?? target.value.length,
    });
  };

  const insertReference = (kind: StorytellerAgentReferenceKind, title: string) => {
    const insertion = kind === "story"
      ? insertStoryMention(value, selection.start, selection.end, title)
      : insertLoreMention(value, selection.start, selection.end, title);
    onChange(insertion.value);
    setSelection({ start: insertion.selectionStart, end: insertion.selectionEnd });
    requestAnimationFrame(() => {
      textareaRef.current?.focus();
      textareaRef.current?.setSelectionRange(insertion.selectionStart, insertion.selectionEnd);
    });
  };

  return (
    <>
      {references.length > 0 && (
        <Stack spacing={0.75} sx={{ mb: 1 }}>
          {references.map((reference) => (
            <Paper key={reference.id} variant="outlined" sx={{ display: "flex", alignItems: "flex-start", gap: 1, px: 1, py: 0.75, bgcolor: "action.hover" }}>
              <FormatQuoteIcon color="action" sx={{ mt: 0.15, fontSize: 17 }} />
              <Box sx={{ flex: 1, minWidth: 0 }}>
                <Typography sx={{ fontSize: 11.5, fontWeight: 700 }}>{reference.title}</Typography>
                <Typography color="text.secondary" sx={{ fontSize: 11.5, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {promptReferencePreview(reference.text)}
                </Typography>
              </Box>
              <Tooltip title={t("workspace.chat.referenceRemove")}>
                <IconButton size="small" aria-label={t("workspace.chat.referenceRemove")} onClick={() => onRemoveReference(reference.id)} sx={{ mt: -0.5, mr: -0.5 }}>
                  <CloseIcon sx={{ fontSize: 16 }} />
                </IconButton>
              </Tooltip>
            </Paper>
          ))}
        </Stack>
      )}
      <Box sx={{ position: "relative" }}>
        <TextField
          inputRef={textareaRef}
          multiline
          minRows={2}
          maxRows={8}
          fullWidth
          variant="standard"
          placeholder={t("workspace.chat.placeholder")}
          value={value}
          disabled={disabled}
          onChange={(event) => {
            onChange(event.target.value);
            syncSelection(event.target);
          }}
          onFocus={(event) => {
            setFocused(true);
            syncSelection(event.target as HTMLTextAreaElement);
          }}
          onBlur={() => setFocused(false)}
          onSelect={(event) => syncSelection(event.target as HTMLTextAreaElement)}
          onKeyUp={(event) => syncSelection(event.target as HTMLTextAreaElement)}
          onMouseUp={(event) => syncSelection(event.target as HTMLTextAreaElement)}
          onCompositionStart={() => {
            compositionRef.current = true;
            setComposing(true);
          }}
          onCompositionEnd={(event) => {
            compositionRef.current = false;
            compositionEndedAtRef.current = performance.now();
            setComposing(false);
            syncSelection(event.target as HTMLTextAreaElement);
          }}
          onKeyDown={(event) => {
            if (event.key !== "Enter" || event.shiftKey) return;
            const native = event.nativeEvent;
            // WebKit 可能在 compositionend 後才送出同一顆 Enter 的 keydown，這時
            // isComposing 已經變成 false；用 100ms 保守窗擋住該次選字 Enter。
            const recentlyEndedComposition = performance.now() - compositionEndedAtRef.current < 100;
            const specialState = compositionRef.current || composing || native.isComposing || native.keyCode === 229 || native.key === "Process" || event.altKey || event.ctrlKey || event.metaKey || recentlyEndedComposition;
            if (specialState) return;
            event.preventDefault();
            onSubmit();
          }}
          slotProps={{
            input: {
              disableUnderline: true,
              sx: {
                position: "relative",
                zIndex: 1,
                fontSize: 14,
                color: composing ? "text.primary" : "transparent",
                caretColor: composing ? "text.primary" : "transparent",
                "& textarea::placeholder": { color: "text.secondary", opacity: 1 },
              },
            },
          }}
        />
        {!composing && (
          <StorytellerPromptHighlightOverlay
            text={value}
            textareaRef={textareaRef}
            includeCurrentReferences={false}
            caretOffset={selection.start}
            showCaret={focused && selection.start === selection.end}
          />
        )}
      </Box>
      <Typography color="text.secondary" sx={{ mt: 0.25, fontSize: 11.5 }}>
        {t("workspace.chat.submitHint")}
      </Typography>
      {suggestions.length > 0 && (
        <Stack direction="row" spacing={0.75} useFlexGap flexWrap="wrap" sx={{ mt: 1 }}>
          {suggestions.map((item) => (
            <Button
              key={`${item.kind}:${item.title}`}
              size="small"
              variant="outlined"
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => insertReference(item.kind, item.title)}
              sx={{ textTransform: "none", fontSize: 12 }}
            >
              {t(`workspace.chat.references.${item.kind}`)}：{item.title}
            </Button>
          ))}
        </Stack>
      )}
      {namedReferences.length > 0 && (
        <Stack direction="row" spacing={0.75} useFlexGap flexWrap="wrap" sx={{ mt: 1 }}>
          {namedReferences.map((reference) => (
            <Chip
              key={reference.token}
              size="small"
              color={reference.kind === "story" ? "primary" : "secondary"}
              variant="outlined"
              label={`${reference.token} → ${reference.title}`}
              sx={{ maxWidth: "100%" }}
            />
          ))}
        </Stack>
      )}
    </>
  );
}

function filterSuggestions(items: DocumentItem[], query: string | null) {
  if (query === null) return [];
  const normalized = query.trim().toLocaleLowerCase();
  const titles = new Set<string>();
  return items.filter((item) => {
    if (titles.has(item.title) || !item.title.toLocaleLowerCase().includes(normalized)) return false;
    titles.add(item.title);
    return true;
  });
}

function resolveReferences(value: string, stories: DocumentItem[], lores: DocumentItem[]): ResolvedReference[] {
  const titles = {
    story: new Set(stories.map((item) => item.title)),
    lore: new Set(lores.map((item) => item.title)),
  };
  const seen = new Set<string>();
  return parseStorytellerAgentReferenceTokens(value).filter((reference) => {
    if (seen.has(reference.token) || !titles[reference.kind].has(reference.title)) return false;
    seen.add(reference.token);
    return true;
  });
}
