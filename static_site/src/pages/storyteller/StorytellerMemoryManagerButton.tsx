import PsychologyAltOutlinedIcon from "@mui/icons-material/PsychologyAltOutlined";
import { Button, IconButton, Tooltip } from "@mui/material";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { StorytellerMascotDialog } from "@/components/storyteller/StorytellerMascotDialog.tsx";
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
      <StorytellerMascotDialog
        open={confirmOpen}
        state="danger"
        eyebrow="離開編輯器"
        title="你有尚未儲存的變更"
        description="前往記憶管理後，還沒存檔的變更會遺失。確定要放棄變更並離開嗎？"
        onClose={() => setConfirmOpen(false)}
        actions={
          <>
            <Button onClick={() => setConfirmOpen(false)}>繼續編輯</Button>
            <Button
              color="error"
              variant="contained"
              onClick={() => {
                setConfirmOpen(false);
                navigateToManager();
              }}
            >
              放棄變更並離開
            </Button>
          </>
        }
      />
    </>
  );
}
