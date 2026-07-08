import HistoryIcon from "@mui/icons-material/History";
import SmartToyIcon from "@mui/icons-material/SmartToy";
import { Paper, Tab, Tabs } from "@mui/material";

export type StorytellerEditorSidePanel = "ai" | "history";

interface StorytellerEditorSideTabsProps {
  value: StorytellerEditorSidePanel;
  onChange: (value: StorytellerEditorSidePanel) => void;
  historyDisabled?: boolean;
}

// 側欄頂端的水平分頁：AI Agent／編輯歷史同一時間只展開一種側欄內容，
// 避免和文字編輯區同時並排時版面過於擁擠。改成水平置頂後，原本佔一整欄
// 高度的直向分頁欄寬可以讓給側欄內容本身使用。
export function StorytellerEditorSideTabs({
  value,
  onChange,
  historyDisabled,
}: StorytellerEditorSideTabsProps) {
  return (
    <Paper variant="outlined" sx={{ borderRadius: 1 }}>
      <Tabs
        value={value}
        onChange={(_, next: StorytellerEditorSidePanel) => onChange(next)}
        variant="fullWidth"
      >
        <Tab
          value="ai"
          icon={<SmartToyIcon fontSize="small" />}
          iconPosition="start"
          label="AI Agent"
        />
        <Tab
          value="history"
          icon={<HistoryIcon fontSize="small" />}
          iconPosition="start"
          label="編輯歷史"
          disabled={historyDisabled}
        />
      </Tabs>
    </Paper>
  );
}
