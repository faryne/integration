import TextFieldsIcon from "@mui/icons-material/TextFields";
import { IconButton, Tooltip } from "@mui/material";
import { useState } from "react";

import { StorytellerResponsivePopover } from "@/pages/storyteller/StorytellerResponsivePopover.tsx";
import { StorytellerTypographySettings } from "@/pages/storyteller/StorytellerTypographySettings.tsx";
import { useStorytellerEditorPreferences } from "@/pages/storyteller/useStorytellerTypographyPreferences.ts";

/** 編輯器文件工具列的「文字設定」：跟閱讀頁同一個面板，只是寫入編輯區自己的偏好。 */
export function StorytellerEditorTypographyButton({
  placement,
}: {
  placement: "top" | "bottom";
}) {
  const { preferences, updatePreferences } = useStorytellerEditorPreferences();
  const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null);

  return (
    <>
      <Tooltip title="文字設定">
        <IconButton
          aria-label="文字設定"
          aria-expanded={Boolean(anchorEl)}
          size="small"
          onClick={(event) => setAnchorEl(event.currentTarget)}
        >
          <TextFieldsIcon fontSize="small" />
        </IconButton>
      </Tooltip>
      <StorytellerResponsivePopover
        anchorEl={anchorEl}
        onClose={() => setAnchorEl(null)}
        title="文字設定"
        width={340}
        // 底部工具列（工作台）往上開，頂部工具列（獨立頁、圖像描述對話框）往下開
        placement={placement === "bottom" ? "above" : "below"}
      >
        <StorytellerTypographySettings
          preferences={preferences}
          onChange={updatePreferences}
          showMeasure={false}
          caption="只影響編輯區的顯示，不會改到作品內容；閱讀頁另有自己的設定。"
        />
      </StorytellerResponsivePopover>
    </>
  );
}
