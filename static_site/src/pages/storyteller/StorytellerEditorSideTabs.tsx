import HistoryIcon from "@mui/icons-material/History";
import SmartToyIcon from "@mui/icons-material/SmartToy";
import VisibilityIcon from "@mui/icons-material/Visibility";
import { Paper, Tab, Tabs } from "@mui/material";

export type StorytellerEditorSidePanel = "ai" | "preview" | "history";

interface StorytellerEditorSideTabsProps {
  value: StorytellerEditorSidePanel;
  onChange: (value: StorytellerEditorSidePanel) => void;
  historyDisabled?: boolean;
}

// 右側垂直分頁：AI Agent／預覽／編輯歷史同一時間只展開一種側欄內容，
// 避免和文字編輯區同時並排時版面過於擁擠。
export function StorytellerEditorSideTabs({
  value,
  onChange,
  historyDisabled,
}: StorytellerEditorSideTabsProps) {
  return (
    <Paper variant="outlined" sx={{ borderRadius: 1, height: "100%" }}>
      <Tabs
        orientation="vertical"
        value={value}
        onChange={(_, next: StorytellerEditorSidePanel) => onChange(next)}
        sx={{
          "& .MuiTab-root": {
            minWidth: 0,
            minHeight: 64,
            fontSize: "0.7rem",
            whiteSpace: "normal",
            lineHeight: 1.3,
          },
        }}
      >
        <Tab
          value="ai"
          icon={<SmartToyIcon fontSize="small" />}
          label="AI Agent"
        />
        <Tab
          value="preview"
          icon={<VisibilityIcon fontSize="small" />}
          label="預覽"
        />
        <Tab
          value="history"
          icon={<HistoryIcon fontSize="small" />}
          label="編輯歷史"
          disabled={historyDisabled}
        />
      </Tabs>
    </Paper>
  );
}
