import AutoFixHighIcon from "@mui/icons-material/AutoFixHigh";
import CompressIcon from "@mui/icons-material/Compress";
import RecordVoiceOverIcon from "@mui/icons-material/RecordVoiceOver";
import UnfoldMoreIcon from "@mui/icons-material/UnfoldMore";
import { IconButton, Stack, Tooltip } from "@mui/material";
import { useTranslation } from "react-i18next";

// [翻譯 key, 指令前綴, 圖示]；web.agent.quickActions.<key>.label 是按鈕文字，
// .prompt 是指令後面帶的補充說明（空字串代表只帶指令）
const AI_QUICK_ACTIONS = [
  ["rewrite", "/rewrite", AutoFixHighIcon],
  ["expand", "/expand", UnfoldMoreIcon],
  ["shorten", "/rewrite", CompressIcon],
  ["tone", "/rewrite", RecordVoiceOverIcon],
] as const;

export function StorytellerAIQuickActions({
  onSelect,
}: {
  onSelect: (prompt: string) => void;
}) {
  const { t } = useTranslation();
  return (
    <Stack direction="row" spacing={0.25}>
      {AI_QUICK_ACTIONS.map(([key, command, Icon]) => (
        <Tooltip key={key} title={t(`web.agent.quickActions.${key}.label`)}>
          <IconButton
            size="small"
            aria-label={t(`web.agent.quickActions.${key}.label`)}
            onClick={() =>
              onSelect(`${command} ${t(`web.agent.quickActions.${key}.prompt`)}`)
            }
          >
            <Icon fontSize="small" />
          </IconButton>
        </Tooltip>
      ))}
    </Stack>
  );
}
