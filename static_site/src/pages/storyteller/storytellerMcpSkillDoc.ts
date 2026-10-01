import type { StorytellerMcpToolDocCategory } from "@/types/storyteller.ts";

// Frontmatter 跟 body 分開 export：react-markdown 不認得 YAML frontmatter，`---`
// 會被當成 <hr/>，兩行 key/value 又沒有空行分隔會被合併成一行——直接把整份內容丟給
// markdown renderer 預覽會呈現得很怪。frontmatter 只在下載的 SKILL.md 裡需要保留
// 原始格式，網頁預覽那邊改成用 code block 包起來單獨呈現（見 McpSkillPreviewDialog.tsx）。
export const STORYTELLER_MCP_SKILL_FRONTMATTER = `name: storyteller-mcp
description: 透過 MCP 存取 SteamLoom（Storyteller）的創作專案、故事、世界觀設定與資產，可讀取、建立、修改、上傳圖片、管理版本歷史。`;

// categories 來自 GET /storyteller/mcp/tools（useStorytellerMcpToolCategories），
// 直接反映後端目前實際掛在 MCP server 上的工具——新增/刪除工具不用回頭改這個檔案。
export function storytellerMcpSkillDocBody(
  mcpEndpoint: string,
  categories: StorytellerMcpToolDocCategory[],
) {
  const toolList = categories
    .map(
      (category) =>
        `### ${category.title}\n\n${category.tools
          .map((tool) => `- \`${tool.name}\` - ${tool.description}`)
          .join("\n")}`,
    )
    .join("\n\n");

  return `# SteamLoom Storyteller MCP

## 這是什麼

MCP（Model Context Protocol）讓 AI Agent 可以透過標準介面連到外部服務。這份 skill 說明如何連接 SteamLoom（Storyteller）的 MCP server，讓 agent 在取得授權後讀寫你的創作專案、故事內容、世界觀設定、章節、版本歷史與圖片資產。

請只在使用者明確要求讀取、建立、修改、刪除或上傳 Storyteller 內容時使用這些工具。寫入前要確認目標專案、故事或設定集，避免把內容存到錯誤位置。

## 連線

連線由使用者在自己的 MCP client 設定完成（OAuth 授權或 Personal Access Token），這份文件不包含任何憑證。若工具呼叫失敗、回傳未授權，或找不到這些工具，請提醒使用者到 SteamLoom 的「開發者 › MCP 連接」頁完成設定，不要要求使用者把 token 貼進對話。

MCP 連線位址：

\`\`\`text
${mcpEndpoint}
\`\`\`

## 可用方法列表

以下清單即時查詢自 MCP server 目前實際掛載的工具，並非手動維護；若你的 client 執行 tools/list 看到的結果跟這裡不同，以 client 實際查到的為準。

${toolList}

## 使用範例

- 「幫我在《XX 故事》裡新增一章，延續之前的語氣」：通常會先用 \`storyteller_get_story\` 或 \`storyteller_list_story_chapters\` 讀取脈絡，再用 \`storyteller_insert_story_chapter\` 寫入新章節。
- 「幫我建立一個新的世界觀設定，並檢查跟現有設定會不會衝突」：通常會用 \`storyteller_list_lores\`、\`storyteller_get_lore\` 讀現有設定，再用 \`storyteller_upsert_lore\` 建立新條目。
- 「把這篇故事復原到上一個版本」：通常會用 \`storyteller_list_story_versions\` 找版本，必要時用 \`storyteller_get_story_version\` 確認內容，再用 \`storyteller_revert_story\` 復原。
- 「幫我把這三張圖上傳成一話圖像故事」：通常會用 \`storyteller_presign_asset_upload\`、\`storyteller_confirm_asset_upload\` 建立資產，再用 \`storyteller_upsert_image_story\` 建立圖像故事。
- 「幫我找出這篇故事裡所有錯字並修正」：通常會先用 \`storyteller_get_story\` 確認內容，再用 \`storyteller_search_replace_story\` 做精準搜尋取代。
`;
}

// 下載用的完整 SKILL.md：frontmatter + body 原樣拼起來，保留標準 frontmatter 格式。
export function storytellerMcpSkillDoc(
  mcpEndpoint: string,
  categories: StorytellerMcpToolDocCategory[],
) {
  return `---
${STORYTELLER_MCP_SKILL_FRONTMATTER}
---

${storytellerMcpSkillDocBody(mcpEndpoint, categories)}`;
}
