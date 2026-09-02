import DeleteIcon from "@mui/icons-material/Delete";
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  IconButton,
  InputLabel,
  MenuItem,
  Select,
  Stack,
  TextField,
  Tooltip,
  Typography,
} from "@mui/material";
import type { SelectChangeEvent } from "@mui/material/Select";
import { useEffect, useMemo, useState } from "react";
import {
  useCreateStorytellerProviderAPIKeyModel,
  useDeleteStorytellerProviderAPIKeyModel,
  useStorytellerProviderAPIKeyModels,
} from "@/apis/storyteller.ts";
import type { StorytellerProviderAPIKeyModel } from "@/types/storyteller.ts";

export function useSelfHostedModelOptions(apiKeyId: number | null | undefined) {
  const query = useStorytellerProviderAPIKeyModels(apiKeyId);
  const createModel = useCreateStorytellerProviderAPIKeyModel();
  const deleteModel = useDeleteStorytellerProviderAPIKeyModel();
  const models = useMemo(() => query.data ?? [], [query.data]);

  async function addModel(name: string) {
    const trimmed = name.trim();
    if (!trimmed || !apiKeyId) {
      return null;
    }
    const row = await createModel.mutateAsync({
      apiKeyId,
      input: { name: trimmed },
    });
    return row ?? null;
  }

  async function removeModel(modelId: number) {
    if (!apiKeyId) {
      return;
    }
    await deleteModel.mutateAsync({ apiKeyId, modelId });
  }

  return {
    models,
    addModel,
    removeModel,
    isLoading: query.isLoading,
    isListUnavailable: query.isError,
    isCreating: createModel.isPending,
    isDeleting: deleteModel.isPending,
    createError: createModel.isError,
    deleteError: deleteModel.isError,
  };
}

export function SelfHostedModelPicker({
  apiKeyId,
  value,
  onChange,
  onApplied,
  variant = "form",
  inputMode = "empty",
  label = "Model Name",
  placeholder = "例如：llama-3.1-70b",
  autoFocus = false,
  autoSelectFirst = false,
}: {
  apiKeyId: number | null | undefined;
  value: string;
  onChange: (name: string) => void;
  onApplied?: (name: string) => void;
  variant?: "menu" | "form";
  inputMode?: "always" | "empty";
  label?: string;
  placeholder?: string;
  autoFocus?: boolean;
  autoSelectFirst?: boolean;
}) {
  const {
    models,
    addModel,
    removeModel,
    isLoading,
    isListUnavailable,
    isCreating,
    isDeleting,
    createError,
    deleteError,
  } = useSelfHostedModelOptions(apiKeyId);
  const [draftName, setDraftName] = useState(value);
  const [confirmingDelete, setConfirmingDelete] =
    useState<StorytellerProviderAPIKeyModel | null>(null);

  useEffect(() => setDraftName(value), [value]);

  useEffect(() => {
    if (!autoSelectFirst || value || models.length === 0) {
      return;
    }
    onChange(models[0].name);
  }, [autoSelectFirst, models, onChange, value]);

  const hasModels = models.length > 0;
  const showInput = isListUnavailable || inputMode === "always" || !hasModels;

  async function applyDraftName() {
    const trimmed = draftName.trim();
    if (!trimmed) {
      return;
    }
    // 清單 API 失敗時退回舊行為：只套用文字，不阻擋原本功能。
    if (isListUnavailable) {
      onChange(trimmed);
      onApplied?.(trimmed);
      return;
    }
    const row = await addModel(trimmed);
    if (row) {
      onChange(row.name);
      onApplied?.(row.name);
      setDraftName("");
    }
  }

  function selectModel(name: string) {
    onChange(name);
    onApplied?.(name);
  }

  function handleSelectChange(event: SelectChangeEvent) {
    selectModel(event.target.value);
  }

  return (
    <Stack spacing={1} sx={variant === "menu" ? { p: 1, minWidth: 320 } : {}}>
      {isLoading && (
        <Stack direction="row" spacing={1} alignItems="center">
          <CircularProgress size={16} />
          <Typography variant="caption" color="text.secondary">
            讀取常用模型中...
          </Typography>
        </Stack>
      )}
      {isListUnavailable && (
        <Alert severity="warning" variant="outlined">
          常用模型清單讀取失敗，先改用手動輸入。
        </Alert>
      )}
      {deleteError && (
        <Alert severity="error" variant="outlined">
          模型名稱刪除失敗，請稍後再試。
        </Alert>
      )}
      {hasModels &&
        (variant === "menu" ? (
          <Stack spacing={0.5}>
            {models.map((model) => (
              <MenuItem
                key={model.id}
                selected={value === model.name}
                onClick={() => selectModel(model.name)}
                sx={{ gap: 1, borderRadius: 1 }}
              >
                <Typography variant="body2" sx={{ flex: 1 }} noWrap>
                  {model.name}
                </Typography>
                <Tooltip title="刪除模型名稱">
                  <IconButton
                    size="small"
                    edge="end"
                    disabled={isDeleting}
                    onMouseDown={(event) => {
                      event.preventDefault();
                      event.stopPropagation();
                    }}
                    onClick={(event) => {
                      event.stopPropagation();
                      setConfirmingDelete(model);
                    }}
                  >
                    <DeleteIcon fontSize="small" />
                  </IconButton>
                </Tooltip>
              </MenuItem>
            ))}
          </Stack>
        ) : (
          <FormControl size="small" fullWidth>
            <InputLabel id={`self-hosted-model-${apiKeyId}-label`}>
              {label}
            </InputLabel>
            <Select
              labelId={`self-hosted-model-${apiKeyId}-label`}
              label={label}
              value={models.some((model) => model.name === value) ? value : ""}
              onChange={handleSelectChange}
            >
              {models.map((model) => (
                <MenuItem key={model.id} value={model.name} sx={{ gap: 1 }}>
                  <Typography variant="body2" sx={{ flex: 1 }} noWrap>
                    {model.name}
                  </Typography>
                  <Tooltip title="刪除模型名稱">
                    <IconButton
                      size="small"
                      edge="end"
                      disabled={isDeleting}
                      onMouseDown={(event) => {
                        event.preventDefault();
                        event.stopPropagation();
                      }}
                      onClick={(event) => {
                        event.stopPropagation();
                        setConfirmingDelete(model);
                      }}
                    >
                      <DeleteIcon fontSize="small" />
                    </IconButton>
                  </Tooltip>
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        ))}
      {showInput && (
        <Stack direction="row" spacing={1} alignItems="center">
          <TextField
            autoFocus={autoFocus}
            size="small"
            label={label}
            placeholder={placeholder}
            value={draftName}
            onChange={(event) => setDraftName(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                void applyDraftName();
              }
            }}
            sx={{ flex: 1 }}
          />
          <Button
            size="small"
            variant="contained"
            disabled={!draftName.trim() || isCreating}
            onClick={() => void applyDraftName()}
          >
            {isCreating ? "儲存中" : "套用"}
          </Button>
        </Stack>
      )}
      {createError && (
        <Alert severity="error" variant="outlined">
          模型名稱儲存失敗，請稍後再試。
        </Alert>
      )}
      <Dialog
        open={Boolean(confirmingDelete)}
        onClose={() => setConfirmingDelete(null)}
        maxWidth="xs"
        fullWidth
      >
        <DialogTitle>刪除模型名稱</DialogTitle>
        <DialogContent>
          <Box sx={{ pt: 1 }}>
            <Typography color="text.secondary">
              確定要刪除「{confirmingDelete?.name}」嗎？此操作無法復原。
            </Typography>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setConfirmingDelete(null)}>取消</Button>
          <Button
            color="error"
            variant="contained"
            disabled={isDeleting || !confirmingDelete}
            onClick={() => {
              if (!confirmingDelete) {
                return;
              }
              const deletedName = confirmingDelete.name;
              void removeModel(confirmingDelete.id).then(() => {
                if (value === deletedName) {
                  onChange("");
                }
                setConfirmingDelete(null);
              });
            }}
          >
            刪除模型
          </Button>
        </DialogActions>
      </Dialog>
    </Stack>
  );
}
