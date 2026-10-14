import AddIcon from "@mui/icons-material/Add";
import ChatBubbleOutlineIcon from "@mui/icons-material/ChatBubbleOutline";
import { Button, Stack, Typography } from "@mui/material";
import { useTranslation } from "react-i18next";

// 尚未選取 thread 時不顯示假對話框；使用者明確建立任務後才進入輸入狀態。
export function ChatTaskLanding({ creating = false, canCreate = false, onCreate }: { creating?: boolean; canCreate?: boolean; onCreate?: () => void }) {
  const { t } = useTranslation();
  return (
    <Stack alignItems="center" justifyContent="center" spacing={1.25} sx={{ flex: 1, px: 4, py: 5, textAlign: "center" }}>
      <ChatBubbleOutlineIcon sx={{ mb: 0.5, fontSize: 44, color: "text.disabled" }} />
      <Typography variant="h6" fontWeight={700}>{t(creating ? "workspace.chat.newTaskTitle" : "workspace.chat.emptyTitle")}</Typography>
      <Typography color="text.secondary" sx={{ maxWidth: 480, fontSize: 13.5 }}>
        {t(creating ? "workspace.chat.newTaskDescription" : "workspace.chat.emptyDescription")}
      </Typography>
      {!creating && (
        <Button variant="contained" startIcon={<AddIcon />} disabled={!canCreate} onClick={onCreate} sx={{ mt: 1 }}>
          {t("workspace.chat.createTask")}
        </Button>
      )}
    </Stack>
  );
}
