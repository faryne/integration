import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  FormControlLabel,
  FormControl,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  Stack,
  Switch,
  TextField,
  Tooltip,
  Typography,
} from "@mui/material";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  useConfirmStorytellerAssistantMemory,
  useDeleteStorytellerAssistantMemoryDraft,
  useRetryStorytellerAssistantMemoryDraft,
  useStorytellerAssistantMemoryDraft,
} from "@/apis/storyteller/agent.ts";
import { CustomSnackbar } from "@/components/common/CustomSnackbar.tsx";
import { StorytellerMascotDialog } from "@/components/storyteller/StorytellerMascotDialog.tsx";
import { StorytellerMemoryTagField } from "@/pages/storyteller/StorytellerMemoryTagField.tsx";
import { useStorytellerMemoryUI } from "@/pages/storyteller/storytellerMemoryUI.ts";
import type {
  StorytellerAssistantMemoryKind,
  StorytellerAssistantMemoryScope,
} from "@/types/storyteller.ts";

export function StorytellerMemoryDraftDialog({
  publicId,
  targetKind,
  providerApiKeyId,
  modelName,
  onClose,
  onSaved,
  onRetried,
}: {
  publicId: string | null;
  targetKind: "story" | "lore";
  providerApiKeyId: number | null;
  modelName: string;
  onClose: () => void;
  onSaved: () => void;
  onRetried: (publicId: string) => void;
}) {
  const { t } = useTranslation();
  const memoryUI = useStorytellerMemoryUI();
  const draftQuery = useStorytellerAssistantMemoryDraft(publicId);
  const confirmMemory = useConfirmStorytellerAssistantMemory();
  const deleteDraft = useDeleteStorytellerAssistantMemoryDraft();
  const retryDraft = useRetryStorytellerAssistantMemoryDraft();
  const [memoryName, setMemoryName] = useState("");
  const [content, setContent] = useState("");
  const [scope, setScope] =
    useState<StorytellerAssistantMemoryScope>(targetKind);
  const [kind, setKind] = useState<StorytellerAssistantMemoryKind>("context");
  const [tags, setTags] = useState<string[]>([]);
  const [priority, setPriority] = useState(50);
  const [isPinned, setIsPinned] = useState(false);
  const [skipSupersede, setSkipSupersede] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const draft = draftQuery.data;

  useEffect(() => {
    if (draft?.status !== "completed" || !draft.should_remember) return;
    setMemoryName(draft.memory_name ?? "");
    setContent(draft.content ?? "");
    setScope(draft.scope_type ?? targetKind);
    setKind(draft.kind ?? "context");
    setTags(draft.tags ?? []);
    setPriority(draft.priority ?? 50);
    setIsPinned(false);
    setSkipSupersede(
      Boolean(draft.supersedes_public_id && !draft.superseded_memory),
    );
  }, [draft, targetKind]);

  function closeAndDiscard() {
    if (retryDraft.isPending || confirmMemory.isPending) return;
    if (publicId && draft?.status !== "confirmed") {
      deleteDraft.mutate(publicId, {
        onError: (error) =>
          setErrorMessage(memoryUI.errorMessage(error)),
      });
    }
    onClose();
  }

  function save() {
    if (!publicId || !content.trim()) return;
    confirmMemory.mutate(
      {
        publicId,
        input: {
          memory_name: memoryName.trim(),
          content: content.trim(),
          scope_type: scope,
          kind,
          tags,
          priority,
          is_pinned: isPinned,
          skip_supersede: skipSupersede,
        },
      },
      {
        onSuccess: onSaved,
        onError: (error) =>
          setErrorMessage(memoryUI.errorMessage(error)),
      },
    );
  }

  function retry() {
    if (!publicId || !providerApiKeyId || !modelName) return;
    retryDraft.mutate(
      {
        publicId,
        input: { provider_apikey_id: providerApiKeyId, model_name: modelName },
      },
      {
        onSuccess: (next) => {
          if (next?.public_id) onRetried(next.public_id);
        },
        onError: (error) =>
          setErrorMessage(memoryUI.errorMessage(error)),
      },
    );
  }

  const loading =
    (!draft && !draftQuery.isError) || draft?.status === "in_progress";
  const failed = draftQuery.isError || draft?.status === "failed";
  const noCandidate =
    draft?.status === "completed" && draft.should_remember === false;

  return (
    <>
      <StorytellerMascotDialog
        open={Boolean(publicId)}
        state={
          loading ? "thinking" : failed || noCandidate ? "neutral" : "success"
        }
        toneLabel={
          loading
            ? t("writer:memory.draft.organizing")
            : t("writer:memory.draft.candidate")
        }
        eyebrow={t("writer:memory.title")}
        title={
          loading
            ? t("writer:memory.draft.loadingTitle")
            : failed
              ? t("writer:memory.draft.failedTitle")
              : noCandidate
                ? t("writer:memory.draft.emptyTitle")
                : t("writer:memory.draft.confirmTitle")
        }
        description={
          loading
            ? t("writer:memory.draft.loadingDescription")
            : failed || noCandidate
              ? undefined
              : t("writer:memory.draft.confirmDescription")
        }
        onClose={closeAndDiscard}
        actions={
          loading || noCandidate ? (
            <Button onClick={closeAndDiscard}>
              {t("writer:common.close")}
            </Button>
          ) : failed ? (
            <>
              <Button onClick={closeAndDiscard}>
                {t("writer:common.close")}
              </Button>
              <Button
                variant="contained"
                onClick={retry}
                disabled={
                  retryDraft.isPending || !providerApiKeyId || !modelName
                }
                startIcon={
                  retryDraft.isPending ? (
                    <CircularProgress size={16} color="inherit" />
                  ) : undefined
                }
              >
                {t("writer:memory.draft.retry")}
              </Button>
            </>
          ) : (
            <>
              <Button
                onClick={closeAndDiscard}
                disabled={confirmMemory.isPending}
              >
                {t("writer:memory.draft.discard")}
              </Button>
              <Button
                variant="contained"
                onClick={save}
                disabled={!content.trim() || confirmMemory.isPending}
                startIcon={
                  confirmMemory.isPending ? (
                    <CircularProgress size={16} color="inherit" />
                  ) : undefined
                }
              >
                {t("writer:memory.draft.save")}
              </Button>
            </>
          )
        }
      >
        {loading ? (
          <Stack alignItems="center" spacing={1.5} sx={{ py: 4 }}>
            <CircularProgress size={30} />
            <Typography color="text.secondary" variant="body2">
              {t("writer:memory.draft.loading")}
            </Typography>
          </Stack>
        ) : failed ? (
          <Alert severity="error">
            {draft?.error_message ?? t("writer:memory.draft.failed")}
          </Alert>
        ) : noCandidate ? (
          <Alert severity="info">
            {t("writer:memory.draft.empty")}
          </Alert>
        ) : (
          <Stack spacing={2}>
            {draft?.supersedes_public_id && (
              <Paper variant="outlined" sx={{ p: 1.5 }}>
                <Alert severity="warning" sx={{ mb: 1.25 }}>
                  {t("writer:memory.draft.supersedeWarning")}
                </Alert>
                {draft.superseded_memory ? (
                  <Stack spacing={0.75}>
                    <Typography fontWeight={800} variant="body2">
                      {draft.superseded_memory.memory_name ||
                        t("writer:memory.draft.oldMemory")}
                    </Typography>
                    <Stack direction="row" spacing={0.75}>
                      <Chip
                        size="small"
                        label={memoryUI.targetLabel(
                          draft.superseded_memory.scope_type,
                          draft.superseded_memory.target_name,
                        )}
                      />
                      <Chip
                        size="small"
                        variant="outlined"
                        label={
                          memoryUI.kindLabels[
                            draft.superseded_memory.kind
                          ]
                        }
                      />
                    </Stack>
                    <Typography
                      variant="body2"
                      color="text.secondary"
                      sx={{ whiteSpace: "pre-wrap" }}
                    >
                      {draft.superseded_memory.content}
                    </Typography>
                  </Stack>
                ) : (
                  <Typography variant="body2" color="text.secondary">
                    {t("writer:memory.draft.oldUnavailable")}
                  </Typography>
                )}
                <FormControlLabel
                  sx={{ mt: 1 }}
                  control={
                    <Switch
                      checked={skipSupersede}
                      onChange={(event) =>
                        setSkipSupersede(event.target.checked)
                      }
                    />
                  }
                  label={t("writer:memory.draft.skipSupersede")}
                />
              </Paper>
            )}
            <TextField
              label={t("writer:memory.name")}
              value={memoryName}
              onChange={(event) => setMemoryName(event.target.value)}
              slotProps={{ htmlInput: { maxLength: 255 } }}
              helperText={`${[...memoryName].length}/255`}
              fullWidth
            />
            <TextField
              label={t("writer:memory.draft.content")}
              value={content}
              onChange={(event) => setContent(event.target.value)}
              slotProps={{ htmlInput: { maxLength: 2000 } }}
              helperText={`${[...content].length}/2000`}
              multiline
              minRows={4}
              fullWidth
              required
            />
            <Box
              sx={{
                display: "grid",
                gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr" },
                gap: 2,
              }}
            >
              <FormControl fullWidth>
                <InputLabel id="memory-scope-label">
                  {t("writer:memory.scope")}
                </InputLabel>
                <Select
                  labelId="memory-scope-label"
                  label={t("writer:memory.scope")}
                  value={scope}
                  onChange={(event) => {
                    const nextScope = event.target
                      .value as StorytellerAssistantMemoryScope;
                    setScope(nextScope);
                    if (
                      draft?.supersedes_public_id &&
                      nextScope !== draft.scope_type
                    ) {
                      setSkipSupersede(true);
                    }
                  }}
                >
                  <MenuItem value="project">
                    {memoryUI.contextScopeLabels.project}
                  </MenuItem>
                  <MenuItem value={targetKind}>
                    {memoryUI.contextScopeLabels[targetKind]}
                  </MenuItem>
                </Select>
              </FormControl>
              <Tooltip title={memoryUI.kindDescriptions[kind]} arrow>
                <FormControl fullWidth>
                  <InputLabel id="memory-kind-label">
                    {t("writer:memory.memoryType")}
                  </InputLabel>
                  <Select
                    labelId="memory-kind-label"
                    label={t("writer:memory.memoryType")}
                    value={kind}
                    onChange={(event) =>
                      setKind(
                        event.target.value as StorytellerAssistantMemoryKind,
                      )
                    }
                  >
                    {Object.entries(memoryUI.kindLabels).map(
                      ([value, label]) => (
                        <MenuItem key={value} value={value}>
                          <Tooltip
                            title={
                              memoryUI.kindDescriptions[
                                value as StorytellerAssistantMemoryKind
                              ]
                            }
                            placement="right"
                            arrow
                          >
                            <Box component="span" sx={{ width: 1 }}>
                              {label}
                            </Box>
                          </Tooltip>
                        </MenuItem>
                      ),
                    )}
                  </Select>
                </FormControl>
              </Tooltip>
            </Box>
            <StorytellerMemoryTagField value={tags} onChange={setTags} />
            <TextField
              type="number"
              label={t("writer:memory.priority")}
              value={priority}
              onChange={(event) =>
                setPriority(
                  Math.max(0, Math.min(100, Number(event.target.value))),
                )
              }
              slotProps={{ htmlInput: { min: 0, max: 100 } }}
              helperText={t("writer:memory.priorityHelp")}
            />
            <FormControlLabel
              control={
                <Switch
                  checked={isPinned}
                  onChange={(event) => setIsPinned(event.target.checked)}
                />
              }
              label={t("writer:memory.draft.pin")}
            />
          </Stack>
        )}
      </StorytellerMascotDialog>
      <CustomSnackbar
        open={Boolean(errorMessage)}
        message={errorMessage}
        severity="error"
        onClose={() => setErrorMessage("")}
      />
    </>
  );
}
