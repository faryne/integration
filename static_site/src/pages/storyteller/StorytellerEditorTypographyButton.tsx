import TextFieldsIcon from "@mui/icons-material/TextFields";
import { IconButton, Tooltip } from "@mui/material";
import { useState } from "react";
import { useTranslation } from "react-i18next";

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
  const { t } = useTranslation();
  const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null);

  return (
    <>
      <Tooltip title={t("writer:editor.typography.title")}>
        <IconButton
          aria-label={t("writer:editor.typography.title")}
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
        title={t("writer:editor.typography.title")}
        width={340}
        // 底部工具列（工作台）往上開，頂部工具列（獨立頁、圖像描述對話框）往下開
        placement={placement === "bottom" ? "above" : "below"}
      >
        <StorytellerTypographySettings
          preferences={preferences}
          onChange={updatePreferences}
          showMeasure={false}
          caption={t("writer:editor.typography.editorCaption")}
        />
      </StorytellerResponsivePopover>
    </>
  );
}
