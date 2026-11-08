import { useState } from "react";

import { CustomSnackbar } from "@/components/common/CustomSnackbar.tsx";

/** 首頁各區塊各自打 API，失敗時各自跳 Snack 提示，不影響其他區塊；關掉後同一次失敗不再跳 */
export function ErrorSnack({
  open,
  message,
}: {
  open: boolean;
  message: string;
}) {
  const [closed, setClosed] = useState(false);
  return (
    <CustomSnackbar
      message={message}
      onClose={() => setClosed(true)}
      open={open && !closed}
      severity="error"
    />
  );
}
