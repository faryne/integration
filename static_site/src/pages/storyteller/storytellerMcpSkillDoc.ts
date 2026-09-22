const STORYTELLER_MCP_SKILL_TOKEN_PLACEHOLDER =
  "<YOUR_PERSONAL_ACCESS_TOKEN>";

interface StorytellerMcpToolDoc {
  name: string;
  description: string;
}

interface StorytellerMcpToolCategory {
  title: string;
  tools: StorytellerMcpToolDoc[];
}

// 這份清單手動對齊 service/storyteller/tool_registry_*.go，讓下載的 SKILL.md
// 不需要連後端也能完整說明目前 MCP server 暴露的工具。
export const storytellerMcpToolCategories: StorytellerMcpToolCategory[] = [
  {
    title: "專案",
    tools: [
      {
        name: "storyteller_list_projects",
        description: "列出已登入使用者的 Storyteller 創作專案。",
      },
      {
        name: "storyteller_get_project",
        description: "讀取單一專案詳情，包含故事與設定集摘要清單。",
      },
    ],
  },
  {
    title: "冊",
    tools: [
      {
        name: "storyteller_list_volumes",
        description: "列出專案底下的冊與故事頂層分組。",
      },
      {
        name: "storyteller_create_volume",
        description: "在專案內建立新的冊。",
      },
      {
        name: "storyteller_update_volume",
        description: "更新冊名、摘要、排序或草稿/完成狀態。",
      },
      {
        name: "storyteller_delete_volume",
        description: "刪除空的冊；冊內仍有故事時會失敗。",
      },
    ],
  },
  {
    title: "設定集 / 世界觀設定",
    tools: [
      {
        name: "storyteller_list_lores",
        description: "分頁列出專案的設定集/世界觀條目摘要。",
      },
      {
        name: "storyteller_list_lore_collections",
        description: "列出設定集分類與各分類內的條目數。",
      },
      {
        name: "storyteller_create_lore_collection",
        description: "建立新的設定集分類。",
      },
      {
        name: "storyteller_update_lore_collection",
        description: "更新設定集分類名稱、說明或排序。",
      },
      {
        name: "storyteller_delete_lore_collection",
        description: "軟刪除空的設定集分類。",
      },
      {
        name: "storyteller_move_lore",
        description: "移動設定集條目到指定分類，或移回未分類。",
      },
      {
        name: "storyteller_get_lore",
        description: "讀取單一設定集條目的完整內容與目前版本。",
      },
      {
        name: "storyteller_upsert_lore",
        description: "建立或覆寫設定集條目，並保存成新版本。",
      },
      {
        name: "storyteller_list_lore_versions",
        description: "列出設定集條目的版本歷史摘要。",
      },
      {
        name: "storyteller_get_lore_version",
        description: "讀取設定集條目某個版本的完整內容。",
      },
      {
        name: "storyteller_revert_lore",
        description: "將設定集條目復原到指定歷史版本。",
      },
      {
        name: "storyteller_patch_lore",
        description: "只更新設定集條目的指定欄位，避免整篇覆寫。",
      },
      {
        name: "storyteller_search_replace_lore",
        description: "在設定集條目內直接搜尋取代並保存新版本。",
      },
      {
        name: "storyteller_delete_lore",
        description: "刪除指定設定集/世界觀條目。",
      },
    ],
  },
  {
    title: "故事 / 話",
    tools: [
      {
        name: "storyteller_list_stories",
        description: "分頁列出專案故事摘要。",
      },
      {
        name: "storyteller_get_story",
        description: "讀取文字故事完整內容，或圖像故事的頁面資料。",
      },
      {
        name: "storyteller_upsert_story",
        description: "建立或覆寫文字故事，並保存成新版本。",
      },
      {
        name: "storyteller_list_story_versions",
        description: "列出故事版本歷史摘要。",
      },
      {
        name: "storyteller_get_story_version",
        description: "讀取故事某個版本的完整內容。",
      },
      {
        name: "storyteller_revert_story",
        description: "將故事復原到指定歷史版本。",
      },
      {
        name: "storyteller_patch_story",
        description: "只更新故事的指定欄位，避免整篇覆寫。",
      },
      {
        name: "storyteller_search_replace_story",
        description: "在文字故事或圖像故事頁面描述內直接搜尋取代。",
      },
      {
        name: "storyteller_move_story",
        description: "移動故事到指定冊，或移出任何冊。",
      },
      {
        name: "storyteller_presign_image_upload",
        description: "取得建立/編輯圖像故事頁面用的 presigned upload URL。",
      },
      {
        name: "storyteller_upsert_image_story",
        description: "使用已上傳圖片建立或覆寫圖像故事。",
      },
      {
        name: "storyteller_delete_story",
        description: "刪除指定故事。",
      },
    ],
  },
  {
    title: "章節",
    tools: [
      {
        name: "storyteller_list_story_chapters",
        description: "列出文字故事依標題切出的章節摘要。",
      },
      {
        name: "storyteller_get_story_chapter",
        description: "依 marker_id 讀取單一故事章節內容。",
      },
      {
        name: "storyteller_list_lore_chapters",
        description: "列出設定集條目依標題切出的章節摘要。",
      },
      {
        name: "storyteller_get_lore_chapter",
        description: "依 marker_id 讀取單一設定集章節內容。",
      },
      {
        name: "storyteller_replace_story_chapter",
        description: "替換故事中的指定章節。",
      },
      {
        name: "storyteller_insert_story_chapter",
        description: "在故事中插入新章節，或附加到文末。",
      },
      {
        name: "storyteller_delete_story_chapter",
        description: "刪除故事中的指定章節。",
      },
      {
        name: "storyteller_replace_lore_chapter",
        description: "替換設定集條目中的指定章節。",
      },
      {
        name: "storyteller_insert_lore_chapter",
        description: "在設定集條目中插入新章節，或附加到文末。",
      },
      {
        name: "storyteller_delete_lore_chapter",
        description: "刪除設定集條目中的指定章節。",
      },
    ],
  },
  {
    title: "資產 / 圖片上傳",
    tools: [
      {
        name: "storyteller_list_assets",
        description: "分頁列出專案圖片資產，可用分類、類型或關鍵字篩選。",
      },
      {
        name: "storyteller_get_asset",
        description: "讀取單一資產 metadata 與短效預覽 URL。",
      },
      {
        name: "storyteller_presign_asset_upload",
        description: "取得圖片資產上傳用的 presigned S3 PUT URLs。",
      },
      {
        name: "storyteller_confirm_asset_upload",
        description: "確認已完成上傳並建立專案資產資料。",
      },
      {
        name: "storyteller_presign_asset_replace",
        description: "取得替換既有圖片資產檔案用的 presigned URL。",
      },
      {
        name: "storyteller_confirm_asset_replace",
        description: "確認替換既有資產檔案；此流程不可復原。",
      },
      {
        name: "storyteller_update_asset",
        description: "更新資產標題、alt text、描述與 metadata。",
      },
      {
        name: "storyteller_move_asset",
        description: "移動資產到指定分類，或移回未分類。",
      },
      {
        name: "storyteller_list_asset_collections",
        description: "列出資產分類與各分類內的資產數。",
      },
      {
        name: "storyteller_create_asset_collection",
        description: "建立新的資產分類。",
      },
      {
        name: "storyteller_update_asset_collection",
        description: "更新資產分類名稱、說明或排序。",
      },
      {
        name: "storyteller_delete_asset_collection",
        description: "軟刪除空的資產分類。",
      },
      {
        name: "storyteller_delete_asset",
        description: "軟刪除未被最新內容引用的專案資產。",
      },
    ],
  },
];

export function storytellerMcpClientConfigSnippet(
  mcpEndpoint: string,
  token = STORYTELLER_MCP_SKILL_TOKEN_PLACEHOLDER,
) {
  return JSON.stringify(
    {
      mcpServers: {
        storyteller: {
          url: mcpEndpoint,
          headers: {
            Authorization: `Bearer ${token}`,
          },
        },
      },
    },
    null,
    2,
  );
}

// Frontmatter 跟 body 分開 export：react-markdown 不認得 YAML frontmatter，`---`
// 會被當成 <hr/>，兩行 key/value 又沒有空行分隔會被合併成一行——直接把整份內容丟給
// markdown renderer 預覽會呈現得很怪。frontmatter 只在下載的 SKILL.md 裡需要保留
// 原始格式，網頁預覽那邊改成用 code block 包起來單獨呈現（見 McpPanel.tsx）。
export const STORYTELLER_MCP_SKILL_FRONTMATTER = `name: storyteller-mcp
description: 透過 MCP 存取 SteamLoom（Storyteller）的創作專案、故事、世界觀設定與資產，可讀取、建立、修改、上傳圖片、管理版本歷史。`;

export function storytellerMcpSkillDocBody(mcpEndpoint: string) {
  const toolList = storytellerMcpToolCategories
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

## 設定方式

1. 在 SteamLoom 的「MCP 連接」頁面查看 MCP 連線位址。
2. 到「金鑰管理」分頁建立一個 Personal Access Token。
3. 在你的 MCP client 設定中加入下列內容，並把 \`${STORYTELLER_MCP_SKILL_TOKEN_PLACEHOLDER}\` 換成剛建立的 token。

連線位址：

\`\`\`text
${mcpEndpoint}
\`\`\`

MCP client 設定範例：

\`\`\`json
${storytellerMcpClientConfigSnippet(mcpEndpoint)}
\`\`\`

這份文件是通用說明文件，不應包含真實 token。若要分享或提交到 repo，請確認設定範例仍使用佔位符。

## 可用方法列表

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
export function storytellerMcpSkillDoc(mcpEndpoint: string) {
  return `---
${STORYTELLER_MCP_SKILL_FRONTMATTER}
---

${storytellerMcpSkillDocBody(mcpEndpoint)}`;
}
