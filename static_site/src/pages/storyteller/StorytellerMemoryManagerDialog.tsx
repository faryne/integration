import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import EditOutlinedIcon from "@mui/icons-material/EditOutlined";
import PushPinIcon from "@mui/icons-material/PushPin";
import PushPinOutlinedIcon from "@mui/icons-material/PushPinOutlined";
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  FormControl,
  FormControlLabel,
  IconButton,
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
  useDeleteStorytellerAssistantMemory,
  useStorytellerAssistantMemories,
  useUpdateStorytellerAssistantMemory,
} from "@/apis/storyteller/agent.ts";
import { CustomSnackbar } from "@/components/common/CustomSnackbar.tsx";
import { StorytellerDialog } from "@/components/storyteller/StorytellerDialog.tsx";
import { StorytellerMascotDialog } from "@/components/storyteller/StorytellerMascotDialog.tsx";
import {
  storytellerMemoryErrorMessage,
  storytellerMemoryKindLabels,
  storytellerMemoryScopeLabels,
} from "@/pages/storyteller/storytellerMemoryUI.ts";
import type {
  StorytellerAssistantMemory,
  StorytellerAssistantMemoryKind,
  StorytellerAssistantMemoryScope,
} from "@/types/storyteller.ts";

export function StorytellerMemoryManagerDialog({
  open,
  projectPublicId,
  targetKind,
  targetPublicId,
  onClose,
}: {
  open: boolean;
  projectPublicId?: string;
  targetKind: "story" | "lore";
  targetPublicId?: string;
  onClose: () => void;
}) {
  const memories = useStorytellerAssistantMemories(
    projectPublicId,
    targetKind,
    targetPublicId,
    open,
  );
  const updateMemory = useUpdateStorytellerAssistantMemory(
    projectPublicId,
    targetKind,
    targetPublicId,
  );
  const deleteMemory = useDeleteStorytellerAssistantMemory(
    projectPublicId,
    targetKind,
    targetPublicId,
  );
  const [editing, setEditing] = useState<StorytellerAssistantMemory | null>(
    null,
  );
  const [deleting, setDeleting] = useState<StorytellerAssistantMemory | null>(
    null,
  );
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    if (memories.isError)
      setErrorMessage(storytellerMemoryErrorMessage(memories.error));
  }, [memories.error, memories.isError]);

  function togglePinned(memory: StorytellerAssistantMemory) {
    updateMemory.mutate(
      {
        publicId: memory.public_id,
        input: {
          memory_name: memory.memory_name ?? "",
          scope_type: memory.scope_type,
          kind: memory.kind,
          content: memory.content,
          priority: memory.priority,
          is_pinned: !memory.is_pinned,
        },
      },
      {
        onError: (error) =>
          setErrorMessage(storytellerMemoryErrorMessage(error)),
      },
    );
  }

  function confirmDelete() {
    if (!deleting) return;
    deleteMemory.mutate(deleting.public_id, {
      onSuccess: () => setDeleting(null),
      onError: (error) => setErrorMessage(storytellerMemoryErrorMessage(error)),
    });
  }

  return (
    <>
      <StorytellerDialog
        open={open}
        maxWidth="md"
        eyebrow="梭梭的記憶"
        title="管理目前會讀到的記憶"
        description="這裡包含所有專案、目前專案，以及這篇故事或設定專屬的記憶。釘選後，梭梭不會自動用新記憶取代它。"
        onClose={onClose}
        actions={<Button onClick={onClose}>關閉</Button>}
      >
        {memories.isLoading ? (
          <Stack alignItems="center" sx={{ py: 5 }}>
            <CircularProgress size={30} />
          </Stack>
        ) : memories.isError ? (
          <Alert severity="error">記憶載入失敗，請稍後再試。</Alert>
        ) : (memories.data?.length ?? 0) === 0 ? (
          <Alert severity="info">目前還沒有適用於這裡的記憶。</Alert>
        ) : (
          <Stack spacing={1.5} sx={{ maxHeight: "55vh", overflowY: "auto" }}>
            {memories.data?.map((memory) => (
              <Paper key={memory.public_id} variant="outlined" sx={{ p: 2 }}>
                <Stack direction="row" alignItems="flex-start" spacing={1}>
                  <Box sx={{ minWidth: 0, flex: 1 }}>
                    <Typography fontWeight={800}>
                      {memory.memory_name || memory.content.slice(0, 36)}
                    </Typography>
                    <Stack direction="row" spacing={0.75} sx={{ mt: 0.75 }}>
                      <Chip
                        size="small"
                        label={storytellerMemoryScopeLabels[memory.scope_type]}
                      />
                      <Chip
                        size="small"
                        variant="outlined"
                        label={storytellerMemoryKindLabels[memory.kind]}
                      />
                    </Stack>
                  </Box>
                  <Tooltip title={memory.is_pinned ? "取消釘選" : "釘選"}>
                    <IconButton
                      size="small"
                      onClick={() => togglePinned(memory)}
                      disabled={updateMemory.isPending}
                    >
                      {memory.is_pinned ? (
                        <PushPinIcon fontSize="small" />
                      ) : (
                        <PushPinOutlinedIcon fontSize="small" />
                      )}
                    </IconButton>
                  </Tooltip>
                  <Tooltip title="編輯">
                    <IconButton size="small" onClick={() => setEditing(memory)}>
                      <EditOutlinedIcon fontSize="small" />
                    </IconButton>
                  </Tooltip>
                  <Tooltip title="刪除">
                    <IconButton
                      size="small"
                      color="error"
                      onClick={() => setDeleting(memory)}
                    >
                      <DeleteOutlineIcon fontSize="small" />
                    </IconButton>
                  </Tooltip>
                </Stack>
                <Typography
                  variant="body2"
                  color="text.secondary"
                  sx={{ mt: 1.5, whiteSpace: "pre-wrap" }}
                >
                  {memory.content}
                </Typography>
              </Paper>
            ))}
          </Stack>
        )}
      </StorytellerDialog>
      <MemoryEditorDialog
        memory={editing}
        targetKind={targetKind}
        saving={updateMemory.isPending}
        onClose={() => setEditing(null)}
        onSave={(input) => {
          if (!editing) return;
          updateMemory.mutate(
            { publicId: editing.public_id, input },
            {
              onSuccess: () => setEditing(null),
              onError: (error) =>
                setErrorMessage(storytellerMemoryErrorMessage(error)),
            },
          );
        }}
      />
      <StorytellerMascotDialog
        open={Boolean(deleting)}
        state="danger"
        eyebrow="刪除記憶"
        title="確定要讓梭梭忘記這件事？"
        description={deleting?.memory_name || deleting?.content.slice(0, 80)}
        onClose={() => !deleteMemory.isPending && setDeleting(null)}
        actions={
          <>
            <Button onClick={() => setDeleting(null)}>取消</Button>
            <Button
              color="error"
              variant="contained"
              disabled={deleteMemory.isPending}
              onClick={confirmDelete}
            >
              確認刪除
            </Button>
          </>
        }
      />
      <CustomSnackbar
        open={Boolean(errorMessage)}
        message={errorMessage}
        severity="error"
        onClose={() => setErrorMessage("")}
      />
    </>
  );
}

function MemoryEditorDialog({
  memory,
  targetKind,
  saving,
  onClose,
  onSave,
}: {
  memory: StorytellerAssistantMemory | null;
  targetKind: "story" | "lore";
  saving: boolean;
  onClose: () => void;
  onSave: (input: {
    memory_name: string;
    scope_type: StorytellerAssistantMemoryScope;
    kind: StorytellerAssistantMemoryKind;
    content: string;
    priority: number;
    is_pinned: boolean;
  }) => void;
}) {
  const [name, setName] = useState("");
  const [content, setContent] = useState("");
  const [scope, setScope] =
    useState<StorytellerAssistantMemoryScope>(targetKind);
  const [kind, setKind] = useState<StorytellerAssistantMemoryKind>("context");
  const [priority, setPriority] = useState(50);
  const [pinned, setPinned] = useState(false);

  useEffect(() => {
    if (!memory) return;
    setName(memory.memory_name ?? "");
    setContent(memory.content);
    setScope(memory.scope_type);
    setKind(memory.kind);
    setPriority(memory.priority);
    setPinned(memory.is_pinned);
  }, [memory]);

  return (
    <StorytellerDialog
      open={Boolean(memory)}
      maxWidth="sm"
      eyebrow="編輯記憶"
      title="調整梭梭記住的內容"
      onClose={saving ? undefined : onClose}
      actions={
        <>
          <Button onClick={onClose} disabled={saving}>
            取消
          </Button>
          <Button
            variant="contained"
            disabled={saving || !content.trim()}
            onClick={() =>
              onSave({
                memory_name: name.trim(),
                scope_type: scope,
                kind,
                content: content.trim(),
                priority,
                is_pinned: pinned,
              })
            }
          >
            儲存
          </Button>
        </>
      }
    >
      <Stack spacing={2}>
        <TextField
          label="記憶名稱"
          value={name}
          onChange={(event) => setName(event.target.value)}
          slotProps={{ htmlInput: { maxLength: 255 } }}
          fullWidth
        />
        <TextField
          label="記憶內容"
          value={content}
          onChange={(event) => setContent(event.target.value)}
          slotProps={{ htmlInput: { maxLength: 2000 } }}
          multiline
          minRows={4}
          required
          fullWidth
        />
        <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
          <FormControl fullWidth>
            <InputLabel>適用範圍</InputLabel>
            <Select
              value={scope}
              label="適用範圍"
              onChange={(event) =>
                setScope(event.target.value as StorytellerAssistantMemoryScope)
              }
            >
              <MenuItem value="account">所有專案</MenuItem>
              <MenuItem value="project">目前專案</MenuItem>
              <MenuItem value={targetKind}>
                {storytellerMemoryScopeLabels[targetKind]}
              </MenuItem>
            </Select>
          </FormControl>
          <FormControl fullWidth>
            <InputLabel>記憶類型</InputLabel>
            <Select
              value={kind}
              label="記憶類型"
              onChange={(event) =>
                setKind(event.target.value as StorytellerAssistantMemoryKind)
              }
            >
              {Object.entries(storytellerMemoryKindLabels).map(
                ([value, label]) => (
                  <MenuItem key={value} value={value}>
                    {label}
                  </MenuItem>
                ),
              )}
            </Select>
          </FormControl>
        </Stack>
        <TextField
          type="number"
          label="優先度"
          value={priority}
          onChange={(event) =>
            setPriority(Math.max(0, Math.min(100, Number(event.target.value))))
          }
          slotProps={{ htmlInput: { min: 0, max: 100 } }}
        />
        <FormControlLabel
          control={
            <Switch
              checked={pinned}
              onChange={(event) => setPinned(event.target.checked)}
            />
          }
          label="釘選這筆記憶"
        />
      </Stack>
    </StorytellerDialog>
  );
}
