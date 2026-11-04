import { useState } from "react";

import { CustomSnackbar } from "@/components/common/CustomSnackbar.tsx";
import { apiErrorMessage } from "@/helpers/apiError.ts";

/**
 * 後台操作失敗時的 SNACK：mutation 的 onError 傳 failed，畫面放 snackbar。
 * fallback 是後端沒給 message 時的預設文字（多語系頁面傳 t() 的結果）
 */
export function useActionFeedback(fallback: string) {
  const [error, setError] = useState<string | null>(null);
  return {
    failed: (e: unknown) => setError(apiErrorMessage(e, fallback)),
    snackbar: (
      <CustomSnackbar
        message={error ?? ""}
        onClose={() => setError(null)}
        open={error !== null}
        severity="error"
      />
    ),
  };
}
