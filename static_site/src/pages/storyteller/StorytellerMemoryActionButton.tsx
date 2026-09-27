import BookmarkAddOutlinedIcon from "@mui/icons-material/BookmarkAddOutlined";
import { Button, CircularProgress } from "@mui/material";
import { storytellerChatActionButtonProps } from "@/pages/storyteller/StorytellerAgentPanel.tsx";

export function StorytellerMemoryActionButton({
  chatId,
  rememberingChatId,
  disabled,
  onRemember,
}: {
  chatId: number;
  rememberingChatId: number | null;
  disabled: boolean;
  onRemember: (chatId: number) => void;
}) {
  const remembering = rememberingChatId === chatId;
  return (
    <Button
      {...storytellerChatActionButtonProps}
      startIcon={
        remembering ? (
          <CircularProgress size={14} />
        ) : (
          <BookmarkAddOutlinedIcon />
        )
      }
      disabled={disabled || remembering}
      onClick={() => onRemember(chatId)}
    >
      {remembering ? "整理中" : "整理成記憶"}
    </Button>
  );
}
