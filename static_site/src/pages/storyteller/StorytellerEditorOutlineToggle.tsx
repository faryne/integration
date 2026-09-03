import TocIcon from "@mui/icons-material/Toc";
import { Box, Popper, ToggleButton, Tooltip } from "@mui/material";
import { useEffect, useId, useState, type ReactNode } from "react";

interface StorytellerEditorOutlineToggleProps {
  open: boolean;
  onToggle: (open: boolean) => void;
  /** 大綱面板本體，浮動掛在這顆切換按鈕下面。 */
  children?: ReactNode;
}

// 大綱／書籤入口：按鈕本身維持 ToggleButton，展開後用 Popper 錨在按鈕上，
// 不再佔左側 dock。刻意不用 MUI Popover／ClickAwayListener——點編輯區跳轉
// 時面板要留著，只有再按一次按鈕或 Escape 才關。
export function StorytellerEditorOutlineToggle({
  open,
  onToggle,
  children,
}: StorytellerEditorOutlineToggleProps) {
  const [anchorEl, setAnchorEl] = useState<HTMLDivElement | null>(null);
  const panelId = useId();

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      // 編輯筆記／刪除確認等 MUI Dialog 自己會吃 Escape；有 modal 開著時不要連
      // 大綱一起關掉。
      if (document.querySelector(".MuiModal-root")) return;
      event.preventDefault();
      onToggle(false);
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open, onToggle]);

  return (
    <>
      <Box ref={setAnchorEl} sx={{ display: "inline-flex" }}>
        <Tooltip title={open ? "收合大綱" : "大綱與書籤"}>
          <ToggleButton
            value="outline"
            selected={open}
            size="small"
            aria-label="大綱與書籤"
            aria-pressed={open}
            aria-expanded={open}
            aria-controls={open ? panelId : undefined}
            onChange={() => onToggle(!open)}
          >
            <TocIcon fontSize="small" />
          </ToggleButton>
        </Tooltip>
      </Box>
      <Popper
        id={panelId}
        open={open}
        anchorEl={anchorEl}
        placement="bottom-start"
        modifiers={[
          { name: "offset", options: { offset: [0, 8] } },
          { name: "preventOverflow", options: { padding: 8 } },
        ]}
        sx={{ zIndex: (theme) => theme.zIndex.modal }}
      >
        <Box
          sx={{
            width: 360,
            maxWidth: "calc(100vw - 16px)",
            maxHeight: "min(70vh, 640px)",
            overflow: "auto",
          }}
        >
          {children}
        </Box>
      </Popper>
    </>
  );
}
