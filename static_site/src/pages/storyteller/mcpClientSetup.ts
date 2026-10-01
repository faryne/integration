// 「開發者」各頁共用的設定：MCP 連線位址、Token 效期選項，以及 MCP 連接頁「設定你的工具」
// 用到的各工具說明與設定格式；新增支援的工具只要在這裡加一筆。
// 指令與設定格式對照各工具官方文件（Claude Code：claude mcp add／login；Codex：config.toml 的
// url、bearer_token_env_var 與 codex mcp login），格式有變時改這裡就好。

import { isSteamLoomSite } from "@/helpers/steamloom.ts";

// MCP endpoint 是給外部工具（Codex、Claude 等）直接連線用，不透過前端自己的
// /api-integration 呼叫路徑；兩個網域各自有 nginx 對應規則，這裡照網域顯示對的網址。
export const mcpEndpoint = isSteamLoomSite()
  ? "https://steamloom.works/mcp"
  : "https://faryne.dev/api-integration/storyteller-mcp";

// OAuth 只在 steamloom.works 開放（faryne.dev 的 MCP 路徑只收 Personal Access Token）。
export const oauthMcpEndpoint = "https://steamloom.works/mcp";

// Personal Access Token 的效期選項；Personal Access Token 頁與 MCP 連接的設定視窗共用。
export const personalAccessTokenExpiryOptions = [
  { value: "30", label: "30 天" },
  { value: "90", label: "90 天" },
  { value: "180", label: "180 天" },
  { value: "365", label: "365 天" },
  { value: "forever", label: "永久（不過期）" },
] as const;

// 選項值轉成 API 的 expires_in_days；永久不過期就不帶這個欄位。
export function personalAccessTokenExpiryDays(value: string) {
  return value === "forever" ? undefined : Number(value);
}

export const MCP_SERVER_NAME = "steamloom";
const PAT_PLACEHOLDER = "<YOUR_PERSONAL_ACCESS_TOKEN>";
// Codex 用環境變數帶 token，避免把明碼寫進 config.toml
const CODEX_TOKEN_ENV = "STEAMLOOM_TOKEN";

export interface McpOAuthTool {
  key: string;
  label: string;
  steps: string[];
  // 需要在終端機執行的指令（CLI 工具才有）
  command?: (endpoint: string) => string;
}

export const mcpOAuthTools: McpOAuthTool[] = [
  {
    key: "claudeai",
    label: "Claude.ai",
    steps: [
      "到 Claude.ai 的設定，新增自訂 connector",
      "名稱填 Steamloom，網址貼上上面的 MCP 位址",
      "按連線後會跳到 Steamloom 授權頁，確認帳號後按「允許」",
    ],
  },
  {
    key: "chatgpt",
    label: "ChatGPT",
    steps: [
      "到 ChatGPT 的設定，新增自訂 connector（需要開啟開發者模式）",
      "網址貼上上面的 MCP 位址，驗證方式選 OAuth",
      "跳到 Steamloom 授權頁後按「允許」",
    ],
  },
  {
    key: "claudecode",
    label: "Claude Code",
    command: (endpoint) =>
      `claude mcp add --transport http ${MCP_SERVER_NAME} ${endpoint}`,
    steps: [
      `在 Claude Code 裡輸入 /mcp 選 ${MCP_SERVER_NAME} 進行驗證（或執行 claude mcp login ${MCP_SERVER_NAME}）`,
      "瀏覽器會跳到 Steamloom 授權頁，按「允許」",
    ],
  },
  {
    key: "codex",
    label: "Codex",
    command: (endpoint) =>
      `codex mcp add ${MCP_SERVER_NAME} --url ${endpoint}\ncodex mcp login ${MCP_SERVER_NAME}`,
    steps: ["執行 login 後瀏覽器會跳到 Steamloom 授權頁，按「允許」"],
  },
  {
    key: "other",
    label: "其他",
    steps: [
      "在工具裡新增遠端 MCP server，貼上上面的 MCP 位址",
      "工具會自動註冊並開啟 Steamloom 授權頁，按「允許」",
      "如果工具要求手動填 Client ID／Client Secret，代表它不支援自動註冊，請改用 Personal Access Token",
    ],
  },
];

export interface McpPatTool {
  key: string;
  label: string;
  // 設定範例上方的說明（例如要貼到哪個檔案）
  snippetLabel: string;
  snippet: (endpoint: string, token: string) => string;
}

export const mcpPatTools: McpPatTool[] = [
  {
    key: "codex",
    label: "Codex CLI",
    snippetLabel: `加到 ~/.codex/config.toml，並在環境變數 ${CODEX_TOKEN_ENV} 放入 token：`,
    snippet: (endpoint, token) =>
      `[mcp_servers.${MCP_SERVER_NAME}]\nurl = "${endpoint}"\nbearer_token_env_var = "${CODEX_TOKEN_ENV}"\n\n# 例如加到 ~/.zshrc\nexport ${CODEX_TOKEN_ENV}="${token}"`,
  },
  {
    key: "claudecode",
    label: "Claude Code",
    snippetLabel: "在終端機執行：",
    snippet: (endpoint, token) =>
      `claude mcp add --transport http ${MCP_SERVER_NAME} ${endpoint} \\\n  --header "Authorization: Bearer ${token}"`,
  },
  {
    key: "json",
    label: "其他（JSON）",
    snippetLabel: "MCP client 設定範例：",
    snippet: (endpoint, token) => mcpJsonConfigSnippet(endpoint, token),
  },
];

// 通用 JSON 設定（mcpServers 格式），Personal Access Token 頁的建立成功對話框也用這個。
export function mcpJsonConfigSnippet(
  endpoint: string,
  token = PAT_PLACEHOLDER,
) {
  return JSON.stringify(
    {
      mcpServers: {
        [MCP_SERVER_NAME]: {
          url: endpoint,
          headers: { Authorization: `Bearer ${token}` },
        },
      },
    },
    null,
    2,
  );
}
