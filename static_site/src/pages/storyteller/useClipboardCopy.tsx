import { useState } from "react";
import { CustomSnackbar } from "@/components/common/CustomSnackbar.tsx";

// 「開發者」各頁共用的複製到剪貼簿行為；snackbars 要放進頁面裡才會顯示成功／失敗提示。
export function useClipboardCopy() {
  const [copied, setCopied] = useState(false);
  const [failed, setFailed] = useState(false);
  async function copy(text: string) {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
    } catch {
      setFailed(true);
    }
  }
  const snackbars = (
    <>
      <CustomSnackbar
        open={copied}
        message="已複製到剪貼簿"
        onClose={() => setCopied(false)}
      />
      <CustomSnackbar
        open={failed}
        message="複製失敗，請手動選取內容。"
        severity="error"
        onClose={() => setFailed(false)}
      />
    </>
  );
  return { copy, snackbars };
}
