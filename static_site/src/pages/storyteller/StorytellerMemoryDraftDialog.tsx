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
import {
  useConfirmStorytellerAssistantMemory,
  useDeleteStorytellerAssistantMemoryDraft,
  useRetryStorytellerAssistantMemoryDraft,
  useStorytellerAssistantMemoryDraft,
} from "@/apis/storyteller/agent.ts";
import { CustomSnackbar } from "@/components/common/CustomSnackbar.tsx";
import { StorytellerMascotDialog } from "@/components/storyteller/StorytellerMascotDialog.tsx";
import { StorytellerMemoryTagField } from "@/pages/storyteller/StorytellerMemoryTagField.tsx";
import {
  storytellerMemoryContextScopeLabels,
  storytellerMemoryErrorMessage,
  storytellerMemoryKindDescriptions,
  storytellerMemoryKindLabels,
  storytellerMemoryTargetLabel,
} from "@/pages/storyteller/storytellerMemoryUI.ts";
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
          setErrorMessage(storytellerMemoryErrorMessage(error)),
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
          setErrorMessage(storytellerMemoryErrorMessage(error)),
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
          setErrorMessage(storytellerMemoryErrorMessage(error)),
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
        toneLabel={loading ? "整理對話中" : "記憶候選"}
        eyebrow="梭梭的記憶"
        title={
          loading
            ? "我正在找值得留下來的事……"
            : failed
              ? "這次沒有整理成功"
              : noCandidate
                ? "這輪沒有需要長期記住的事"
                : "確認要記住的內容"
        }
        description={
          loading
            ? "整理完成後會先讓你檢查，不會自動寫進記憶。"
            : failed || noCandidate
              ? undefined
              : "你可以修改內容與適用範圍；按下「存進記憶」後，之後的對話才會讀到它。"
        }
        onClose={closeAndDiscard}
        actions={
          loading || noCandidate ? (
            <Button onClick={closeAndDiscard}>關閉</Button>
          ) : failed ? (
            <>
              <Button onClick={closeAndDiscard}>關閉</Button>
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
                重新整理
              </Button>
            </>
          ) : (
            <>
              <Button
                onClick={closeAndDiscard}
                disabled={confirmMemory.isPending}
              >
                不儲存
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
                存進記憶
              </Button>
            </>
          )
        }
      >
        {loading ? (
          <Stack alignItems="center" spacing={1.5} sx={{ py: 4 }}>
            <CircularProgress size={30} />
            <Typography color="text.secondary" variant="body2">
              梭梭正在把這輪對話整理成一件清楚、之後看得懂的事。
            </Typography>
          </Stack>
        ) : failed ? (
          <Alert severity="error">
            {draft?.error_message ?? "記憶整理失敗，請稍後再試。"}
          </Alert>
        ) : noCandidate ? (
          <Alert severity="info">
            這輪比較像一次性的請求，沒有找到適合長期記住的內容。
          </Alert>
        ) : (
          <Stack spacing={2}>
            {draft?.supersedes_public_id && (
              <Paper variant="outlined" sx={{ p: 1.5 }}>
                <Alert severity="warning" sx={{ mb: 1.25 }}>
                  這筆候選原本會取代下面的舊記憶。如果你改了適用範圍，或想保留兩筆，請選擇「不取代，另存一筆」。
                </Alert>
                {draft.superseded_memory ? (
                  <Stack spacing={0.75}>
                    <Typography fontWeight={800} variant="body2">
                      {draft.superseded_memory.memory_name || "舊記憶"}
                    </Typography>
                    <Stack direction="row" spacing={0.75}>
                      <Chip
                        size="small"
                        label={storytellerMemoryTargetLabel(
                          draft.superseded_memory.scope_type,
                          draft.superseded_memory.target_name,
                        )}
                      />
                      <Chip
                        size="small"
                        variant="outlined"
                        label={
                          storytellerMemoryKindLabels[
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
                    舊記憶已不在目前可讀範圍，建議另存一筆。
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
                  label="不取代，另存一筆"
                />
              </Paper>
            )}
            <TextField
              label="記憶名稱"
              value={memoryName}
              onChange={(event) => setMemoryName(event.target.value)}
              slotProps={{ htmlInput: { maxLength: 255 } }}
              helperText={`${[...memoryName].length}/255`}
              fullWidth
            />
            <TextField
              label="要記住的內容"
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
                <InputLabel id="memory-scope-label">適用範圍</InputLabel>
                <Select
                  labelId="memory-scope-label"
                  label="適用範圍"
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
                    {storytellerMemoryContextScopeLabels.project}
                  </MenuItem>
                  <MenuItem value={targetKind}>
                    {storytellerMemoryContextScopeLabels[targetKind]}
                  </MenuItem>
                </Select>
              </FormControl>
              <Tooltip title={storytellerMemoryKindDescriptions[kind]} arrow>
                <FormControl fullWidth>
                  <InputLabel id="memory-kind-label">記憶類型</InputLabel>
                  <Select
                    labelId="memory-kind-label"
                    label="記憶類型"
                    value={kind}
                    onChange={(event) =>
                      setKind(
                        event.target.value as StorytellerAssistantMemoryKind,
                      )
                    }
                  >
                    {Object.entries(storytellerMemoryKindLabels).map(
                      ([value, label]) => (
                        <MenuItem key={value} value={value}>
                          <Tooltip
                            title={
                              storytellerMemoryKindDescriptions[
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
              label="優先度"
              value={priority}
              onChange={(event) =>
                setPriority(
                  Math.max(0, Math.min(100, Number(event.target.value))),
                )
              }
              slotProps={{ htmlInput: { min: 0, max: 100 } }}
              helperText="0–100，數字越高越優先提供給梭梭"
            />
            <FormControlLabel
              control={
                <Switch
                  checked={isPinned}
                  onChange={(event) => setIsPinned(event.target.checked)}
                />
              }
              label="釘選這筆記憶，避免日後被自動取代"
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
