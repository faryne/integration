package storyteller

// MCPServerInstructions 是 storyteller MCP server 在 initialize 回給 client 的使用引導。
//
// 只寫單一工具描述表達不了的跨工具流程（先讀記憶、提議而非擅自寫記憶、版本衝突偵測）；
// 參數細節留在各工具描述。部分 client 會截斷過長的 instructions，重點要放前面。
// 記憶衝突的優先序與梭梭的 promptRuleMemories 對齊，站內站外行為一致。
const MCPServerInstructions = `Storyteller is the author's writing workspace: projects hold stories, lore (worldbuilding) and image assets. Every call acts on the authenticated author's own data.

READ MEMORIES BEFORE YOU WRITE
- The author keeps confirmed, long-lived writing memories per project (shown in the web UI as 「梭梭的記憶」, shared by the built-in assistant and every MCP client). They hold style preferences, standing instructions, settled plot/setting decisions and background that are not in the story text.
- Before drafting, continuing, rewriting or reviewing a story or lore entry, call storyteller_list_memories with project_public_id plus that story_public_id or lore_public_id. Once per target per conversation; call again when the target changes. Use storyteller_search_memories for a specific character, term or scene.
- Don't know project_public_id? Call storyteller_list_projects first.
- Apply relevant memories without announcing them. Precedence: the author's current request > facts in the current story/lore text > story/lore-scoped memories > project-scoped memories. Pinned and higher-priority memories win ties. If a memory conflicts with the current request, follow the request and briefly ask whether to update the memory.

PROPOSE MEMORIES, NEVER WRITE SILENTLY
- When the author says something meant to last ("from now on…", "never…", a correction with a before/after example, a settled plot decision), offer to save it. Show the exact content, scope, kind and tags, and call storyteller_upsert_memory only after the author agrees in the conversation — MCP writes take effect immediately, with no review step.
- Search first; if a memory already covers it, update that one (memory_public_id) instead of adding a near-duplicate.
- Never store secrets, credentials, personal data, one-off task state, or your own guesses.

EDITING
- Keep version_id from storyteller_get_story / storyteller_get_lore and pass it back as base_version_id when saving, so edits made in the web editor meanwhile are detected instead of overwritten.
- For long stories, prefer chapter tools (storyteller_list_story_chapters, storyteller_get_story_chapter, storyteller_replace_story_chapter) over rewriting the whole story.`
