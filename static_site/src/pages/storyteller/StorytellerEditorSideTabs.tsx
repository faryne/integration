import AutoAwesomeIcon from "@mui/icons-material/AutoAwesome";
import HistoryIcon from "@mui/icons-material/History";
import SmartToyIcon from "@mui/icons-material/SmartToy";
import { ToggleButton, ToggleButtonGroup, Tooltip } from "@mui/material";

// "ai" 是既有單輪、無工具呼叫能力的改寫/擴寫/翻譯 skill 面板；"agentic" 是 AAS
// 多輪、會自己呼叫工具查資料／提出修改提案的問答面板，兩者刻意分開，不是同一個
// 面板換皮——各自有不同的訊息模型跟互動流程。
export type StorytellerEditorSidePanel = "ai" | "agentic" | "history";

interface StorytellerEditorSideTabsProps {
  value: StorytellerEditorSidePanel | null;
  onChange: (value: StorytellerEditorSidePanel | null) => void;
  historyDisabled?: boolean;
  agenticDisabled?: boolean;
}

// AI Agent／AI 問答／編輯歷史收合成幾顆切換按鈕，交給 StorytellerWysiwygEditor
// 的文件層級 action 區呈現：預設收起，讓作者能專注在編輯區本身；點開哪個就在原本
// 的側欄位置展開對應內容，再點一次收合（exclusive ToggleButtonGroup 本身就支援
// 點選中項目變成 null）。
export function StorytellerEditorSideTabs({
  value,
  onChange,
  historyDisabled,
  agenticDisabled,
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
      <ToggleButton
        value="agentic"
        disabled={agenticDisabled}
        aria-label="AI 問答"
      >
        <Tooltip title="AI 問答（會自己讀資料、可提出修改提案）">
          <AutoAwesomeIcon fontSize="small" />
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
