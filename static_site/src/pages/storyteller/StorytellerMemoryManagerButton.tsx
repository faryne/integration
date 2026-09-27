import PsychologyAltOutlinedIcon from "@mui/icons-material/PsychologyAltOutlined";
import { IconButton, Tooltip } from "@mui/material";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { StorytellerUnsavedChangesDialog } from "@/components/storyteller/StorytellerUnsavedChangesDialog.tsx";
import { steamloomPath } from "@/helpers/steamloom.ts";

// AI 面板只保留 contextual shortcut；真正的搜尋、篩選與分頁都在工作台管理頁。
export function StorytellerMemoryManagerButton({
  projectPublicId,
  targetKind,
  targetPublicId,
  hasUnsavedChanges,
}: {
  projectPublicId?: string;
  targetKind: "story" | "lore";
  targetPublicId?: string;
  hasUnsavedChanges?: () => boolean;
}) {
  const navigate = useNavigate();
  const [confirmOpen, setConfirmOpen] = useState(false);

  function navigateToManager() {
    if (!projectPublicId || !targetPublicId) return;
    navigate(
      steamloomPath(
        `my/workspace/${projectPublicId}/memories?context=${targetKind}&target=${encodeURIComponent(targetPublicId)}`,
      ),
    );
  }

  return (
    <>
      <Tooltip title="管理梭梭的記憶">
        <IconButton
          size="small"
          aria-label="管理梭梭的記憶"
          onClick={() =>
            hasUnsavedChanges?.() ? setConfirmOpen(true) : navigateToManager()
          }
          sx={{ ml: "auto" }}
        >
          <PsychologyAltOutlinedIcon fontSize="small" />
        </IconButton>
      </Tooltip>
      <StorytellerUnsavedChangesDialog
        open={confirmOpen}
        onContinueEditing={() => setConfirmOpen(false)}
        onDiscardChanges={() => {
          setConfirmOpen(false);
          navigateToManager();
        }}
      />
    </>
  );
}
