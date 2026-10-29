import { useEffect, useState } from "react";
import { CustomSnackbar } from "@/components/common/CustomSnackbar.tsx";
import { apiErrorMessage } from "@/helpers/apiError.ts";

/** API 錯誤時跳出 snack；error 換成新的錯誤才會再次跳出 */
export function TwStatsErrorSnack({ error }: { error: unknown }) {
  const [closed, setClosed] = useState<unknown>(null);
  useEffect(() => setClosed(null), [error]);
  return (
    <CustomSnackbar
      open={!!error && closed !== error}
      severity={"error"}
      message={apiErrorMessage(error, "資料載入失敗，請稍後再試")}
      onClose={() => setClosed(error)}
    />
  );
}
