import { useState } from "react";
import { CustomSnackbar } from "@/components/common/CustomSnackbar.tsx";
import { isSteamLoomSite } from "@/helpers/steamloom.ts";

// MCP endpoint 是給外部工具（Codex、Claude 等）直接連線用，不透過前端自己的
// /api-integration 呼叫路徑；兩個網域各自有 nginx 對應規則，這裡照網域顯示對的網址。
export const mcpEndpoint = isSteamLoomSite()
  ? "https://steamloom.works/mcp"
  : "https://faryne.dev/api-integration/storyteller-mcp";

// OAuth 只在 steamloom.works 開放（faryne.dev 的 MCP 路徑只收 Personal Access Token）。
export const oauthMcpEndpoint = "https://steamloom.works/mcp";

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
