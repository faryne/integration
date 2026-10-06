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
    runLabel: "在終端機執行：",
    command: `curl -fsSL ${skillBase}/skill-installer.sh | sh`,
    inspect: `curl -fsSL ${skillBase}/skill-installer.sh -o skill-installer.sh\nless skill-installer.sh\nsh skill-installer.sh`,
    downloadUrl: `${skillBase}/skill-installer.sh?download=1`,
    downloadLabel: "下載安裝程式（.sh）",
  },
  win: {
    label: "Windows（PowerShell）",
    runLabel: "在 PowerShell 執行：",
    command: `irm ${skillBase}/skill-installer.ps1 | iex`,
    inspect: `irm ${skillBase}/skill-installer.ps1 -OutFile skill-installer.ps1\nnotepad skill-installer.ps1\npowershell -ExecutionPolicy Bypass -File .\\skill-installer.ps1`,
    downloadUrl: `${skillBase}/skill-installer.ps1?download=1`,
    downloadLabel: "下載安裝程式（.ps1）",
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

export type McpAuthMethod = "oauth" | "pat";

export const mcpAuthMeta: Record<
  McpAuthMethod,
  { label: string; description: string }
> = {
  oauth: {
    label: "OAuth 授權",
    description:
      "在瀏覽器按一次「允許」就連上了，不用複製 token。隨時可以到 OAuth Token 頁撤銷。",
  },
  pat: {
    label: "Personal Access Token",
    description:
      "建立一組 token 貼進工具的設定。適合不能開瀏覽器的環境（例如遠端伺服器）。",
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
  "下載 Skill 的 ZIP 檔（不用解壓縮）",
  where,
  "Skill 更新時，重新下載 ZIP 再上傳一次；之前上傳過舊版（名稱叫 storyteller-mcp）的話，請在技能列表把舊的移除。",
];

export const mcpServices: McpService[] = [
  {
    key: "claudeai",
    label: "Claude.ai",
    description: "網頁版、桌面版與手機 App",
    authMethods: ["oauth"],
    oauthOnlyReason:
      "Claude.ai 的自訂 connector 只能用 OAuth，不能自己填 token。",
    oauthSteps: [
      { text: "到 Claude.ai 的「設定 › Connectors」，新增自訂 connector" },
      {
        text: "名稱填 SteamLoom，網址貼上：",
        code: (endpoint) => endpoint,
      },
      { text: "按「連線」後會跳到 SteamLoom 授權頁，確認帳號後按「允許」" },
    ],
    skill: {
      kind: "upload",
      steps: [
        "先到「設定 › 功能」開啟「程式碼執行與檔案建立」（Team／Enterprise 方案要由管理員開啟）",
        ...uploadZipSteps(
          "到「自訂 › 技能」，按「＋」→「上傳技能」，選剛才下載的 ZIP",
        ),
      ],
    },
  },
  {
    key: "chatgpt",
    label: "ChatGPT",
    description: "需要開啟開發者模式",
    authMethods: ["oauth"],
    oauthOnlyReason:
      "ChatGPT 的自訂 connector 只能用 OAuth，不能自己填 token。",
    oauthSteps: [
      {
        text: "到 ChatGPT 的「設定 › 應用程式與連接器」，開啟開發者模式後新增 connector",
      },
      {
        text: "網址貼上下面的位址，驗證方式選 OAuth：",
        code: (endpoint) => endpoint,
      },
      { text: "跳到 SteamLoom 授權頁後按「允許」" },
    ],
    skill: {
      kind: "upload",
      steps: uploadZipSteps(
        "到 ChatGPT 的 Skills，選擇建立 → 從電腦上傳，選剛才下載的 ZIP；ChatGPT 會先掃描，掃描完就能用",
      ),
    },
  },
  {
    key: "claudecode",
    label: "Claude Code",
    description: "終端機與 IDE",
    authMethods: ["oauth", "pat"],
    oauthSteps: [
      {
        text: "在終端機執行：",
        code: (endpoint) =>
          `claude mcp add --transport http ${MCP_SERVER_NAME} ${endpoint}`,
      },
      {
        text: `在 Claude Code 裡輸入 /mcp，選 ${MCP_SERVER_NAME} 進行驗證（或執行 claude mcp login ${MCP_SERVER_NAME}）`,
      },
      { text: "瀏覽器會跳到 SteamLoom 授權頁，按「允許」" },
    ],
    pat: {
      snippetLabel: "在終端機執行：",
      snippet: (endpoint, token) =>
        `claude mcp add --transport http ${MCP_SERVER_NAME} ${endpoint} \\\n  --header "Authorization: Bearer ${token}"`,
    },
    skill: { kind: "installer" },
  },
  {
    key: "codex",
    label: "Codex",
    description: "Codex CLI 與 IDE 擴充",
    authMethods: ["oauth", "pat"],
    oauthSteps: [
      {
        text: "在終端機執行：",
        code: (endpoint) =>
          `codex mcp add ${MCP_SERVER_NAME} --url ${endpoint}\ncodex mcp login ${MCP_SERVER_NAME}`,
      },
      { text: "執行 login 後瀏覽器會跳到 SteamLoom 授權頁，按「允許」" },
    ],
    pat: {
      snippetLabel: `加到 ~/.codex/config.toml，並在環境變數 ${CODEX_TOKEN_ENV} 放入 token：`,
      snippet: (endpoint, token) =>
        `[mcp_servers.${MCP_SERVER_NAME}]\nurl = "${endpoint}"\nbearer_token_env_var = "${CODEX_TOKEN_ENV}"\n\n# 例如加到 ~/.zshrc\nexport ${CODEX_TOKEN_ENV}="${token}"`,
    },
    skill: { kind: "installer" },
  },
  {
    key: "other",
    label: "其他",
    description: "其他支援遠端 MCP 的工具",
    authMethods: ["oauth", "pat"],
    oauthSteps: [
      {
        text: "在工具裡新增遠端 MCP server，貼上：",
        code: (endpoint) => endpoint,
      },
      { text: "工具會自動註冊並開啟 SteamLoom 授權頁，按「允許」" },
      {
        text: "如果工具要求手動填 Client ID／Client Secret，代表它不支援自動註冊，請回上一步改選 Personal Access Token",
      },
    ],
    pat: {
      snippetLabel: "MCP client 設定範例（JSON）：",
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
