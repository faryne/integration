import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import EditOutlinedIcon from "@mui/icons-material/EditOutlined";
import PushPinIcon from "@mui/icons-material/PushPin";
import PushPinOutlinedIcon from "@mui/icons-material/PushPinOutlined";
import {
  Box,
  Chip,
  IconButton,
  Paper,
  Stack,
  Tooltip,
  Typography,
} from "@mui/material";
import {
  storytellerMemoryKindDescriptions,
  storytellerMemoryKindLabels,
  storytellerMemoryTargetLabel,
} from "@/pages/storyteller/storytellerMemoryUI.ts";
import type { StorytellerAssistantMemory } from "@/types/storyteller.ts";

export function MemoryCard({
  memory,
  mutating,
  onTogglePinned,
  onEdit,
  onDelete,
  onTagClick,
}: {
  memory: StorytellerAssistantMemory;
  mutating: boolean;
  onTogglePinned: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onTagClick: (tag: string) => void;
}) {
  return (
    <Paper variant="outlined" sx={{ p: { xs: 1.5, sm: 2 } }}>
      <Stack direction="row" alignItems="flex-start" spacing={1}>
        <Box sx={{ minWidth: 0, flex: 1 }}>
          <Typography fontWeight={800}>
            {memory.memory_name || memory.content.slice(0, 48)}
          </Typography>
          <Stack
            direction="row"
            useFlexGap
            flexWrap="wrap"
            spacing={0.75}
            sx={{ mt: 0.75 }}
          >
            <Chip
              size="small"
              label={storytellerMemoryTargetLabel(
                memory.scope_type,
                memory.target_name,
              )}
            />
            {(memory.tags ?? []).map((tag) => (
              <Chip
                key={tag}
                size="small"
                variant="outlined"
                label={`#${tag}`}
                onClick={() => onTagClick(tag)}
              />
            ))}
            <Tooltip
              title={storytellerMemoryKindDescriptions[memory.kind]}
              arrow
            >
              <Chip
                size="small"
                variant="outlined"
                label={storytellerMemoryKindLabels[memory.kind]}
              />
            </Tooltip>
            <Chip
              size="small"
              variant="outlined"
              label={`優先度 ${memory.priority}`}
            />
          </Stack>
        </Box>
        <Tooltip title={memory.is_pinned ? "取消釘選" : "釘選"}>
          <IconButton size="small" disabled={mutating} onClick={onTogglePinned}>
            {memory.is_pinned ? (
              <PushPinIcon fontSize="small" />
            ) : (
              <PushPinOutlinedIcon fontSize="small" />
            )}
          </IconButton>
        </Tooltip>
        <Tooltip title="編輯">
          <IconButton size="small" onClick={onEdit}>
            <EditOutlinedIcon fontSize="small" />
          </IconButton>
        </Tooltip>
        <Tooltip title="刪除">
          <IconButton size="small" color="error" onClick={onDelete}>
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
      <Typography
        variant="caption"
        color="text.disabled"
        sx={{ display: "block", mt: 1 }}
      >
        更新於 {new Date(memory.updated_at).toLocaleString("zh-TW")}
      </Typography>
    </Paper>
  );
}
