import { useState } from "react";

// 討論元件共用的 snack 與登入提示狀態
export function useDiscussionFeedback() {
  const [snack, setSnack] = useState<{
    message: string;
    severity: "success" | "error";
  } | null>(null);
  const [loginOpen, setLoginOpen] = useState(false);
  return {
    notify: (message: string, severity: "success" | "error" = "success") =>
      setSnack({ message, severity }),
    askLogin: () => setLoginOpen(true),
    loginOpen,
    closeLogin: () => setLoginOpen(false),
    snackProps: {
      open: Boolean(snack),
      message: snack?.message ?? "",
      severity: snack?.severity ?? ("success" as const),
      onClose: () => setSnack(null),
    },
  };
}
