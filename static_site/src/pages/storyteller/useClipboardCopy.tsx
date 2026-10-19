import { useState } from "react";
import { useTranslation } from "react-i18next";
import { CustomSnackbar } from "@/components/common/CustomSnackbar.tsx";

// 「開發者」各頁共用的複製到剪貼簿行為；snackbars 要放進頁面裡才會顯示成功／失敗提示。
export function useClipboardCopy() {
  const { t } = useTranslation();
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
        message={t("web.developer.copied")}
        onClose={() => setCopied(false)}
      />
      <CustomSnackbar
        open={failed}
        message={t("web.developer.copyFailed")}
        severity="error"
        onClose={() => setFailed(false)}
      />
    </>
  );
  return { copy, snackbars };
}
