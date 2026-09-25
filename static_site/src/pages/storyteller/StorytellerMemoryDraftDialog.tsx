import {
  Alert,
  Box,
  Button,
  CircularProgress,
  FormControl,
  InputLabel,
  MenuItem,
  Select,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import { useEffect, useState } from "react";
import {
  useConfirmStorytellerAssistantMemory,
  useDeleteStorytellerAssistantMemoryDraft,
  useStorytellerAssistantMemoryDraft,
} from "@/apis/storyteller/agent.ts";
import { CustomSnackbar } from "@/components/common/CustomSnackbar.tsx";
import { StorytellerMascotDialog } from "@/components/storyteller/StorytellerMascotDialog.tsx";
import type {
  StorytellerAssistantMemoryKind,
  StorytellerAssistantMemoryScope,
} from "@/types/storyteller.ts";

const kindLabels: Record<StorytellerAssistantMemoryKind, string> = {
  preference: "偏好",
  instruction: "持續指示",
  decision: "已確認決策",
  context: "背景資訊",
};

function memoryErrorMessage(error: unknown) {
  if (
    typeof error === "object" &&
    error !== null &&
    "response" in error &&
    typeof error.response === "object" &&
    error.response !== null &&
    "data" in error.response
  ) {
    const data = error.response.data as { message?: string };
    if (data.message) return data.message;
  }
  return "記憶操作失敗，請稍後再試。";
}

export function StorytellerMemoryDraftDialog({
  publicId,
  targetKind,
  onClose,
  onSaved,
}: {
  publicId: string | null;
  targetKind: "story" | "lore";
  onClose: () => void;
  onSaved: () => void;
}) {
  const draftQuery = useStorytellerAssistantMemoryDraft(publicId);
  const confirmMemory = useConfirmStorytellerAssistantMemory();
  const deleteDraft = useDeleteStorytellerAssistantMemoryDraft();
  const [memoryName, setMemoryName] = useState("");
  const [content, setContent] = useState("");
  const [scope, setScope] =
    useState<StorytellerAssistantMemoryScope>(targetKind);
  const [kind, setKind] = useState<StorytellerAssistantMemoryKind>("context");
  const [priority, setPriority] = useState(50);
  const [errorMessage, setErrorMessage] = useState("");
  const draft = draftQuery.data;

  useEffect(() => {
    if (draft?.status !== "completed" || !draft.should_remember) return;
    setMemoryName(draft.memory_name ?? "");
    setContent(draft.content ?? "");
    setScope(draft.scope_type ?? targetKind);
    setKind(draft.kind ?? "context");
    setPriority(draft.priority ?? 50);
  }, [draft, targetKind]);

  function closeAndDiscard() {
    if (publicId && draft?.status !== "confirmed") {
      deleteDraft.mutate(publicId, {
        onError: (error) => setErrorMessage(memoryErrorMessage(error)),
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
          priority,
        },
      },
      {
        onSuccess: onSaved,
        onError: (error) => setErrorMessage(memoryErrorMessage(error)),
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
          loading || failed || noCandidate ? (
            <Button onClick={closeAndDiscard}>關閉</Button>
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
                  onChange={(event) =>
                    setScope(
                      event.target.value as StorytellerAssistantMemoryScope,
                    )
                  }
                >
                  <MenuItem value="account">所有專案</MenuItem>
                  <MenuItem value="project">目前專案</MenuItem>
                  <MenuItem value={targetKind}>
                    {targetKind === "story" ? "這篇故事" : "這則設定"}
                  </MenuItem>
                </Select>
              </FormControl>
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
                  {Object.entries(kindLabels).map(([value, label]) => (
                    <MenuItem key={value} value={value}>
                      {label}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Box>
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
