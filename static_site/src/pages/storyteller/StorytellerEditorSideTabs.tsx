import HistoryIcon from "@mui/icons-material/History";
import SmartToyIcon from "@mui/icons-material/SmartToy";
import { ToggleButton, ToggleButtonGroup, Tooltip } from "@mui/material";

export type StorytellerEditorSidePanel = "ai" | "history";

interface StorytellerEditorSideTabsProps {
  value: StorytellerEditorSidePanel | null;
  onChange: (value: StorytellerEditorSidePanel | null) => void;
  historyDisabled?: boolean;
}

// AI Agent／編輯歷史收合成兩顆切換按鈕，交給 StorytellerWysiwygEditor 的文件層級
// action 區呈現：預設收起，讓作者能專注在編輯區本身；點開哪個就在原本的側欄位置展開
// 對應內容，再點一次收合（exclusive ToggleButtonGroup 本身就支援點選中項目變成 null）。
export function StorytellerEditorSideTabs({
  value,
  onChange,
  historyDisabled,
}: StorytellerEditorSideTabsProps) {
  return (
    <ToggleButtonGroup
      value={value}
      exclusive
      onChange={(_, next: StorytellerEditorSidePanel | null) => onChange(next)}
      size="small"
    >
      <ToggleButton value="ai" aria-label="AI Agent">
        <Tooltip title="AI Agent">
          <SmartToyIcon fontSize="small" />
        </Tooltip>
      </ToggleButton>
      <ToggleButton value="history" disabled={historyDisabled} aria-label="編輯歷史">
        <Tooltip title="編輯歷史">
          <HistoryIcon fontSize="small" />
        </Tooltip>
      </ToggleButton>
    </ToggleButtonGroup>
  );
}
