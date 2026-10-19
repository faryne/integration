// 網站與 SteamLoom Writer 共用；Writer 透過 alias 直接 import（改這支也會影響 Writer）。

// 對應後端 story/lore version 的 source 欄位：web_auto／web_manual／web_agent_apply
// 是網頁編輯頁自己存的，"mcp:<token label>" 是外部工具透過 MCP 用哪把 Personal
// Access Token 寫入的。source 可能因為資料庫還沒跑過補欄位的 migration、或本來
// 就是舊資料而缺值，一律當手動存檔。
import type { TFunction } from "i18next";

export function storytellerVersionSourceLabel(
  source: string | null | undefined,
  t?: TFunction,
) {
  if (t) {
    if (source === "web_auto") return t("writer:editor.history.sources.auto");
    if (source === "web_agent_apply") return t("writer:editor.history.sources.agent");
    if (source?.startsWith("mcp:")) {
      const label = source.slice("mcp:".length);
      return t(label ? "writer:editor.history.sources.mcpPat" : "writer:editor.history.sources.mcp", { label });
    }
    return t("writer:editor.history.sources.manual");
  }
  if (!source) {
    return "手動存檔";
  }
  if (source === "web_auto") {
    return "自動存檔";
  }
  if (source === "web_agent_apply") {
    return "套用 AI 提案存檔";
  }
  if (source.startsWith("mcp:")) {
    const label = source.slice("mcp:".length);
    return label ? `透過 MCP 使用 PAT「${label}」操作` : "透過 MCP 操作";
  }
  return "手動存檔";
}
