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
import { useTranslation } from "react-i18next";
import { StorytellerDialog } from "@/components/storyteller/StorytellerDialog.tsx";
import { StorytellerMemoryTagField } from "@/pages/storyteller/StorytellerMemoryTagField.tsx";
import { useStorytellerMemoryUI } from "@/pages/storyteller/storytellerMemoryUI.ts";
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
  const { t } = useTranslation();
  const memoryUI = useStorytellerMemoryUI();
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
      eyebrow={t("writer:memory.edit")}
      title={t("writer:memory.editTitle")}
      onClose={saving ? undefined : onClose}
      actions={
        <>
          <Button onClick={onClose} disabled={saving}>
            {t("writer:common.cancel")}
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
            {t("writer:common.save")}
          </Button>
        </>
      }
    >
      <Stack spacing={2}>
        <TextField
          label={t("writer:memory.name")}
          value={name}
          onChange={(event) => setName(event.target.value)}
          slotProps={{ htmlInput: { maxLength: 255 } }}
          fullWidth
        />
        <TextField
          label={t("writer:memory.content")}
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
            <InputLabel>{t("writer:memory.scope")}</InputLabel>
            <Select
              value={scope}
              label={t("writer:memory.scope")}
              onChange={(event) =>
                setScope(event.target.value as StorytellerAssistantMemoryScope)
              }
            >
              <MenuItem value="project">
                {memoryUI.targetLabel("project")}
              </MenuItem>
              {targetKind && (
                <MenuItem value={targetKind}>
                  {memoryUI.targetLabel(
                    targetKind,
                    memory?.target_name,
                  )}
                </MenuItem>
              )}
            </Select>
          </FormControl>
          <Tooltip title={memoryUI.kindDescriptions[kind]} arrow>
            <FormControl fullWidth>
              <InputLabel>{t("writer:memory.memoryType")}</InputLabel>
              <Select
                value={kind}
                label={t("writer:memory.memoryType")}
                onChange={(event) =>
                  setKind(event.target.value as StorytellerAssistantMemoryKind)
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
        </Stack>
        <StorytellerMemoryTagField value={tags} onChange={setTags} />
        <TextField
          type="number"
          label={t("writer:memory.priority")}
          value={priority}
          onChange={(event) =>
            setPriority(Math.max(0, Math.min(100, Number(event.target.value))))
          }
          slotProps={{ htmlInput: { min: 0, max: 100 } }}
          helperText={t("writer:memory.priorityHelp")}
        />
        <FormControlLabel
          control={
            <Switch
              checked={pinned}
              onChange={(event) => setPinned(event.target.checked)}
            />
          }
          label={t("writer:memory.pinMemory")}
        />
      </Stack>
    </StorytellerDialog>
  );
}
