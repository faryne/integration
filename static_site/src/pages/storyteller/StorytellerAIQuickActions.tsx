import AutoFixHighIcon from "@mui/icons-material/AutoFixHigh";
import CompressIcon from "@mui/icons-material/Compress";
import RecordVoiceOverIcon from "@mui/icons-material/RecordVoiceOver";
import UnfoldMoreIcon from "@mui/icons-material/UnfoldMore";
import { IconButton, Stack, Tooltip } from "@mui/material";

const AI_QUICK_ACTIONS = [
  ["改寫內容", "/rewrite ", AutoFixHighIcon],
  ["擴寫內容", "/expand ", UnfoldMoreIcon],
  ["縮短內容", "/rewrite 請縮短內容，保留必要資訊。", CompressIcon],
  ["調整語氣", "/rewrite 請調整語氣：", RecordVoiceOverIcon],
] as const;

export function StorytellerAIQuickActions({
  onSelect,
}: {
  onSelect: (prompt: string) => void;
}) {
  return (
    <Stack direction="row" spacing={0.25}>
      {AI_QUICK_ACTIONS.map(([label, prompt, Icon]) => (
        <Tooltip key={label} title={label}>
          <IconButton
            size="small"
            aria-label={label}
            onClick={() => onSelect(prompt)}
          >
            <Icon fontSize="small" />
          </IconButton>
        </Tooltip>
      ))}
    </Stack>
  );
}
