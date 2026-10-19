// 「開發者」各頁共用的設定：MCP 連線位址、Token 效期選項，以及 MCP 連接頁四個步驟用到的
// 各 AI 服務資料（支援的授權方式、連線步驟、Skill 安裝方式）；新增支援的服務只要在 mcpServices 加一筆。
// 指令與路徑對照各服務官方文件，格式有變時改這裡就好：
// - Claude Code：claude mcp add／login；skill 放 ~/.claude/skills/<name>/SKILL.md（code.claude.com/docs/en/skills）
// - Codex：codex mcp add／login、config.toml 的 bearer_token_env_var；skill 放 ~/.agents/skills/<name>/SKILL.md
//   （learn.chatgpt.com/docs/build-skills）
// - Claude.ai：自訂 › 技能 › 上傳技能，只收 ZIP（support.claude.com/en/articles/12512180）
// - ChatGPT：Skills 從電腦上傳 ZIP（OpenAI Help Center 20001066，選單位置待人工確認）

import { apiBase } from "@/apis/storyteller/shared.ts";
import { isSteamLoomSite } from "@/helpers/steamloom.ts";

// MCP endpoint 是給外部工具（Codex、Claude 等）直接連線用，不透過前端自己的
// /api-integration 呼叫路徑；兩個網域各自有 nginx 對應規則，這裡照網域顯示對的網址。
export const mcpEndpoint = isSteamLoomSite()
  ? "https://steamloom.works/mcp"
  : "https://faryne.dev/api-integration/storyteller-mcp";

// OAuth 只在 steamloom.works 開放（faryne.dev 的 MCP 路徑只收 Personal Access Token）。
export const oauthMcpEndpoint = "https://steamloom.works/mcp";

// Skill 的公開網址（後端 GET /storyteller-mcp/skill.md／skill.zip）。steamloom.works 的 nginx 會把整個
// /mcp 前綴改寫成 /storyteller-mcp，所以品牌網址是 steamloom.works/mcp/skill.md；steamloom.works 沒有
// /api-integration（會落到前端首頁）。faryne.dev 與本機開發則走 API base 底下的 /storyteller-mcp。
const skillBase = isSteamLoomSite()
  ? "https://steamloom.works/mcp"
  : `${apiBase}/storyteller-mcp`;
export const mcpSkillMarkdownUrl = `${skillBase}/skill.md`;
export const mcpSkillZipUrl = `${skillBase}/skill.zip`;
// 跟後端 MCPSkillName 一致：skill 名稱＝安裝資料夾名稱＝ZIP 內的資料夾名稱
export const MCP_SKILL_NAME = "steamloom";

// Claude Code／Codex 共用的 Skill 安裝程式（後端 GET /storyteller-mcp/skill-installer.sh／.ps1）：
// 偵測裝了哪個工具就裝到哪個、比對版本、清掉改名前的舊版。兩支各有固定網址，server 不看 User-Agent，
// OS 由連接頁依瀏覽器預選、作者可自己切換。
export type McpSkillInstallerOs = "unix" | "win";

export const mcpSkillInstallers: Record<
  McpSkillInstallerOs,
  {
    label: string;
    runLabel: string;
    command: string;
    inspect: string;
    downloadUrl: string;
    downloadLabel: string;
  }
> = {
  unix: {
    label: "macOS／Linux",
    runLabel: "web.mcp.runInTerminal",
    command: `curl -fsSL ${skillBase}/skill-installer.sh | sh`,
    inspect: `curl -fsSL ${skillBase}/skill-installer.sh -o skill-installer.sh\nless skill-installer.sh\nsh skill-installer.sh`,
    downloadUrl: `${skillBase}/skill-installer.sh?download=1`,
    downloadLabel: "web.mcp.installer.downloadSh",
  },
  win: {
    label: "Windows（PowerShell）",
    runLabel: "web.mcp.installer.runInPowerShell",
    command: `irm ${skillBase}/skill-installer.ps1 | iex`,
    inspect: `irm ${skillBase}/skill-installer.ps1 -OutFile skill-installer.ps1\nnotepad skill-installer.ps1\npowershell -ExecutionPolicy Bypass -File .\\skill-installer.ps1`,
    downloadUrl: `${skillBase}/skill-installer.ps1?download=1`,
    downloadLabel: "web.mcp.installer.downloadPs1",
  },
};

// 依瀏覽器判斷預設顯示哪個安裝程式；userAgentData 只有 Chromium 系有，其他退回 userAgent
export function detectSkillInstallerOs(): McpSkillInstallerOs {
  const platform =
    (navigator as Navigator & { userAgentData?: { platform?: string } })
      .userAgentData?.platform ?? navigator.userAgent;
  return /win/i.test(platform) ? "win" : "unix";
}

// Personal Access Token 的效期選項；Personal Access Token 頁與 MCP 連接頁共用。
// label 是翻譯 key，days 帶進 {{count}}
export const personalAccessTokenExpiryOptions = [
  { value: "30", label: "web.mcp.expiry.days", days: 30 },
  { value: "90", label: "web.mcp.expiry.days", days: 90 },
  { value: "180", label: "web.mcp.expiry.days", days: 180 },
  { value: "365", label: "web.mcp.expiry.days", days: 365 },
  { value: "forever", label: "web.mcp.expiry.forever", days: 0 },
] as const;

// 選項值轉成 API 的 expires_in_days；永久不過期就不帶這個欄位。
export function personalAccessTokenExpiryDays(value: string) {
  return value === "forever" ? undefined : Number(value);
}

export const MCP_SERVER_NAME = "steamloom";
const PAT_PLACEHOLDER = "<YOUR_PERSONAL_ACCESS_TOKEN>";
// Codex 用環境變數帶 token，避免把明碼寫進 config.toml
const CODEX_TOKEN_ENV = "STEAMLOOM_TOKEN";

// 這支檔案裡的文字欄位都存翻譯 key（web.mcp.*），呈現端用 t(key, mcpTextParams) 取字，
// 需要帶入的伺服器名稱／環境變數名稱統一放這裡。
export const mcpTextParams = { server: MCP_SERVER_NAME, env: CODEX_TOKEN_ENV };

export type McpAuthMethod = "oauth" | "pat";

export const mcpAuthMeta: Record<
  McpAuthMethod,
  { label: string; description: string }
> = {
  oauth: {
    label: "web.mcp.auth.oauth.label",
    description: "web.mcp.auth.oauth.description",
  },
  pat: {
    label: "web.mcp.auth.pat.label",
    description: "web.mcp.auth.pat.description",
  },
};

// 連線步驟裡的一步；code 是要複製的指令或網址（依 MCP 位址產生）
export interface McpSetupStep {
  text: string;
  code?: (endpoint: string) => string;
}

// Skill 安裝方式：CLI 工具用安裝程式，網頁服務給 ZIP 上傳步驟，其他工具給下載
export type McpSkillInstall =
  | { kind: "installer" }
  | { kind: "upload"; steps: string[] }
  | { kind: "download" };

export interface McpService {
  key: string;
  label: string;
  description: string;
  // 支援的授權方式，第一個是推薦的
  authMethods: McpAuthMethod[];
  // 只支援 OAuth 時，告訴作者為什麼不能選 PAT
  oauthOnlyReason?: string;
  oauthSteps: McpSetupStep[];
  // 支援 PAT 的服務才有：建立 token 後顯示的設定說明與內容
  pat?: {
    snippetLabel: string;
    snippet: (endpoint: string, token: string) => string;
  };
  skill: McpSkillInstall;
}

const uploadZipSteps = (where: string) => [
  "web.mcp.skill.downloadZip",
  where,
  "web.mcp.skill.updateZip",
];

export const mcpServices: McpService[] = [
  {
    key: "claudeai",
    label: "web.mcp.services.claudeai.label",
    description: "web.mcp.services.claudeai.description",
    authMethods: ["oauth"],
    oauthOnlyReason: "web.mcp.services.claudeai.oauthOnly",
    oauthSteps: [
      { text: "web.mcp.services.claudeai.steps.add" },
      {
        text: "web.mcp.services.claudeai.steps.url",
        code: (endpoint) => endpoint,
      },
      { text: "web.mcp.services.claudeai.steps.allow" },
    ],
    skill: {
      kind: "upload",
      steps: [
        "web.mcp.services.claudeai.skill.enableCode",
        ...uploadZipSteps("web.mcp.services.claudeai.skill.upload"),
      ],
    },
  },
  {
    key: "chatgpt",
    label: "web.mcp.services.chatgpt.label",
    description: "web.mcp.services.chatgpt.description",
    authMethods: ["oauth"],
    oauthOnlyReason: "web.mcp.services.chatgpt.oauthOnly",
    oauthSteps: [
      { text: "web.mcp.services.chatgpt.steps.add" },
      {
        text: "web.mcp.services.chatgpt.steps.url",
        code: (endpoint) => endpoint,
      },
      { text: "web.mcp.services.chatgpt.steps.allow" },
    ],
    skill: {
      kind: "upload",
      steps: uploadZipSteps("web.mcp.services.chatgpt.skill.upload"),
    },
  },
  {
    key: "claudecode",
    label: "web.mcp.services.claudecode.label",
    description: "web.mcp.services.claudecode.description",
    authMethods: ["oauth", "pat"],
    oauthSteps: [
      {
        text: "web.mcp.runInTerminal",
        code: (endpoint) =>
          `claude mcp add --transport http ${MCP_SERVER_NAME} ${endpoint}`,
      },
      { text: "web.mcp.services.claudecode.steps.login" },
      { text: "web.mcp.services.claudecode.steps.allow" },
    ],
    pat: {
      snippetLabel: "web.mcp.runInTerminal",
      snippet: (endpoint, token) =>
        `claude mcp add --transport http ${MCP_SERVER_NAME} ${endpoint} \\\n  --header "Authorization: Bearer ${token}"`,
    },
    skill: { kind: "installer" },
  },
  {
    key: "codex",
    label: "web.mcp.services.codex.label",
    description: "web.mcp.services.codex.description",
    authMethods: ["oauth", "pat"],
    oauthSteps: [
      {
        text: "web.mcp.runInTerminal",
        code: (endpoint) =>
          `codex mcp add ${MCP_SERVER_NAME} --url ${endpoint}\ncodex mcp login ${MCP_SERVER_NAME}`,
      },
      { text: "web.mcp.services.codex.steps.allow" },
    ],
    pat: {
      snippetLabel: "web.mcp.services.codex.patSnippet",
      snippet: (endpoint, token) =>
        `[mcp_servers.${MCP_SERVER_NAME}]\nurl = "${endpoint}"\nbearer_token_env_var = "${CODEX_TOKEN_ENV}"\n\n# e.g. add to ~/.zshrc\nexport ${CODEX_TOKEN_ENV}="${token}"`,
    },
    skill: { kind: "installer" },
  },
  {
    key: "other",
    label: "web.mcp.services.other.label",
    description: "web.mcp.services.other.description",
    authMethods: ["oauth", "pat"],
    oauthSteps: [
      {
        text: "web.mcp.services.other.steps.add",
        code: (endpoint) => endpoint,
      },
      { text: "web.mcp.services.other.steps.allow" },
      { text: "web.mcp.services.other.steps.manualClient" },
    ],
    pat: {
      snippetLabel: "web.mcp.services.other.patSnippet",
      snippet: (endpoint, token) => mcpJsonConfigSnippet(endpoint, token),
    },
    skill: { kind: "download" },
  },
];

// faryne.dev 網域只能用 PAT：只支援 OAuth 的服務在這裡沒有可用的授權方式
export function availableAuthMethods(service: McpService): McpAuthMethod[] {
  return isSteamLoomSite()
    ? service.authMethods
    : service.authMethods.filter((method) => method !== "oauth");
}

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
