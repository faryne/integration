import { Box, Button, Chip, Stack, TextField } from "@mui/material";
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
  onChange,
  onSubmit,
}: {
  workspace: Workspace;
  value: string;
  disabled: boolean;
  onChange: (value: string) => void;
  onSubmit: () => void;
}) {
  const { t } = useTranslation();
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [selection, setSelection] = useState<PromptSelection>({ start: 0, end: 0 });
  const [composing, setComposing] = useState(false);
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
  const references = useMemo(() => resolveReferences(value, stories, lores), [lores, stories, value]);

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
          onSelect={(event) => syncSelection(event.target as HTMLTextAreaElement)}
          onKeyUp={(event) => syncSelection(event.target as HTMLTextAreaElement)}
          onMouseUp={(event) => syncSelection(event.target as HTMLTextAreaElement)}
          onCompositionStart={() => setComposing(true)}
          onCompositionEnd={(event) => {
            setComposing(false);
            syncSelection(event.target as HTMLTextAreaElement);
          }}
          onKeyDown={(event) => {
            if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) {
              event.preventDefault();
              onSubmit();
            }
          }}
          slotProps={{
            input: {
              disableUnderline: true,
              sx: {
                position: "relative",
                zIndex: 1,
                fontSize: 14,
                color: composing ? "text.primary" : "transparent",
                caretColor: "text.primary",
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
          />
        )}
      </Box>
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
      {references.length > 0 && (
        <Stack direction="row" spacing={0.75} useFlexGap flexWrap="wrap" sx={{ mt: 1 }}>
          {references.map((reference) => (
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
