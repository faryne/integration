import {
  Box,
  Button,
  FormControl,
  FormControlLabel,
  InputLabel,
  MenuItem,
  Select,
  Stack,
  Switch,
  TextField,
  Tooltip,
} from "@mui/material";
import { useEffect, useState } from "react";
import { StorytellerDialog } from "@/components/storyteller/StorytellerDialog.tsx";
import { StorytellerMemoryTagField } from "@/pages/storyteller/StorytellerMemoryTagField.tsx";
import {
  storytellerMemoryKindDescriptions,
  storytellerMemoryKindLabels,
  storytellerMemoryTargetLabel,
} from "@/pages/storyteller/storytellerMemoryUI.ts";
import type {
  StorytellerAssistantMemory,
  StorytellerAssistantMemoryKind,
  StorytellerAssistantMemoryScope,
  StorytellerAssistantMemoryUpdateRequest,
} from "@/types/storyteller.ts";

// 完整管理頁只把單筆編輯留在 modal；大量瀏覽、篩選與分頁都由頁面本身負責。
export function StorytellerMemoryEditorDialog({
  memory,
  targetKind,
  saving,
  onClose,
  onSave,
}: {
  memory: StorytellerAssistantMemory | null;
  targetKind?: "story" | "lore";
  saving: boolean;
  onClose: () => void;
  onSave: (input: StorytellerAssistantMemoryUpdateRequest) => void;
}) {
  const [name, setName] = useState("");
  const [content, setContent] = useState("");
  const [scope, setScope] =
    useState<StorytellerAssistantMemoryScope>("project");
  const [kind, setKind] = useState<StorytellerAssistantMemoryKind>("context");
  const [tags, setTags] = useState<string[]>([]);
  const [priority, setPriority] = useState(50);
  const [pinned, setPinned] = useState(false);

  useEffect(() => {
    if (!memory) return;
    setName(memory.memory_name ?? "");
    setContent(memory.content);
    setScope(memory.scope_type);
    setKind(memory.kind);
    setTags(memory.tags ?? []);
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
                tags,
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
              <MenuItem value="project">
                {storytellerMemoryTargetLabel("project")}
              </MenuItem>
              {targetKind && (
                <MenuItem value={targetKind}>
                  {storytellerMemoryTargetLabel(
                    targetKind,
                    memory?.target_name,
                  )}
                </MenuItem>
              )}
            </Select>
          </FormControl>
          <Tooltip title={storytellerMemoryKindDescriptions[kind]} arrow>
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
        </Stack>
        <StorytellerMemoryTagField value={tags} onChange={setTags} />
        <TextField
          type="number"
          label="優先度"
          value={priority}
          onChange={(event) =>
            setPriority(Math.max(0, Math.min(100, Number(event.target.value))))
          }
          slotProps={{ htmlInput: { min: 0, max: 100 } }}
          helperText="0–100，數字越高越優先提供給梭梭"
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
