import HistoryIcon from "@mui/icons-material/History";
import SmartToyIcon from "@mui/icons-material/SmartToy";
import { Stack, ToggleButton, ToggleButtonGroup, Tooltip } from "@mui/material";

export type StorytellerEditorSidePanel = "ai" | "history";

interface StorytellerEditorSideTabsProps {
  value: StorytellerEditorSidePanel | null;
  onChange: (value: StorytellerEditorSidePanel | null) => void;
  historyDisabled?: boolean;
}

// AI Agent／編輯歷史收合成編輯區上方的兩顆切換按鈕：預設收起，讓作者能專注在
// 編輯區本身；點開哪個就在原本的側欄位置展開對應內容，再點一次收合（exclusive
// ToggleButtonGroup 本身就支援點選中項目變成 null 取消選取）。
export function StorytellerEditorSideTabs({
  value,
  onChange,
  historyDisabled,
}: StorytellerEditorSideTabsProps) {
  return (
    <Stack direction="row" justifyContent="flex-end">
      <ToggleButtonGroup
        value={value}
        exclusive
        onChange={(_, next: StorytellerEditorSidePanel | null) =>
          onChange(next)
        }
        size="small"
      >
        <ToggleButton value="ai">
          <Tooltip title="AI Agent">
            <SmartToyIcon fontSize="small" />
          </Tooltip>
        </ToggleButton>
        <ToggleButton value="history" disabled={historyDisabled}>
          <Tooltip title="編輯歷史">
            <HistoryIcon fontSize="small" />
          </Tooltip>
        </ToggleButton>
      </ToggleButtonGroup>
    </Stack>
  );
}
