import TocIcon from "@mui/icons-material/Toc";
import { ToggleButton, Tooltip } from "@mui/material";

interface StorytellerEditorOutlineToggleProps {
  open: boolean;
  onToggle: (open: boolean) => void;
}

// 左側大綱／書籤面板的收合按鈕。刻意獨立於右側 StorytellerEditorSideTabs，
// 兩邊可以同時展開，不互斥。
export function StorytellerEditorOutlineToggle({
  open,
  onToggle,
}: StorytellerEditorOutlineToggleProps) {
  return (
    <Tooltip title={open ? "收合大綱" : "大綱與書籤"}>
      <ToggleButton
        value="outline"
        selected={open}
        size="small"
        aria-label="大綱與書籤"
        aria-pressed={open}
        onChange={() => onToggle(!open)}
      >
        <TocIcon fontSize="small" />
      </ToggleButton>
    </Tooltip>
  );
}
