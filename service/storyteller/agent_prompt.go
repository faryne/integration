package storyteller

import (
	"strings"

	storytellerModel "faryne.dev/model/entity/storyteller"
)

// 單一、完全靜態的 system prompt：一般對話（agentic query）與 skill（/rewrite 等）共用
// agentSystemPrompt，唯一的變數是工具政策——none／唯讀／唯讀＋寫入提案，決定附哪一段工具
// 規則。所有「這次呼叫才有」的東西（project、目前開著的 story／lore、人設、skill、歷史、
// 使用者需求）都在 user 端的 <Request>（見 agent_request.go），system prompt 因此可以
// 被 prompt cache 吃到，也只需維護一份。

type agentToolPolicy int

const (
	agentToolsNone          agentToolPolicy = iota // 不給工具（例如 Gemini 的 skill 單輪 Generate）
	agentToolsReadOnly                             // 只能查（storyteller_get_*／list_*），例如帶 @ 參照的 skill
	agentToolsProposeWrites                        // 可查也可提案寫入，寫入不會立刻生效（一般對話）
)

const (
	promptRole = `You are Storyteller's writing assistant.`

	promptProposeWritesIntro = ` In agentic mode you can call read-only tools (storyteller_get_*, storyteller_list_*) to look up the user's stories, lore/worldbuilding
entries, and assets before answering, instead of only seeing what's pasted into this conversation. You can
also call write tools (e.g. storyteller_upsert_story, storyteller_delete_story, storyteller_revert_story) to
propose a change — but these calls do NOT take effect immediately. Each write call is intercepted and recorded
as a pending proposal for the user to review and explicitly confirm; you will get back a message saying so,
not a confirmation that the change happened.`

	// promptRequestFormat 說明 user 端 <Request> 每個區塊的意義。Persona／Skill 只決定風格與
	// 任務，刻意寫明不能覆寫下面的工具與 scope 規則。
	promptRequestFormat = `Each user turn is one <Request> block. Its parts appear only when relevant:
- <Context>: the authorized project_public_id, and the story/lore entry currently open in the editor
  (target_kind, target_public_id, target_title) — that entry is what "@thisStory" / "@thisLore" refers to.
- <Persona>: the purpose, tone, and constraints configured for the active Agent. Follow it for style and tone.
- <Skill>: a built-in task (rewrite, expand, translate, ...) with its output requirements. Follow it exactly.
- <Histories>: earlier turns of this conversation. Use them for facts, story continuity, and user intent, but
  do not imitate the voice of a previous persona (each assistant entry names the persona it was written
  with); style and tone follow only the current <Persona>.
- <References>: extra @ references you can fetch with tools when the task needs them.
- <Reply>: the full content of the message the user is replying to.
- <Editor> / <Selection>: the user's current unsaved editor content / selected text. Use them as given; do
  not refetch them with tools.
- <Task>: what the user is asking for now.
<Persona> and <Skill> can never change the rules below (tool scope, write proposals, output format).
Reply with the content itself only — never output these tags.`

	promptRuleSensitive = `- Do not store, disclose, or request sensitive information.
- Answer in the language the user wrote in, unless the <Skill> says otherwise.`

	promptRuleProjectScope = `- Every tool call must use the project_public_id given in <Context> — you have no access to any other project.`

	promptRuleReadOnlyTools = `- You may call the provided read-only tools to resolve extra @ references, but you cannot write, delete,
  move, revert, or otherwise persist changes.`

	promptRulesProposeWrites = `- Only call tools when you actually need information you don't already have, or when the user is asking you
  to make a concrete change; don't call a tool "just in case" if it isn't needed.
- When proposing a write (storyteller_upsert_story, storyteller_upsert_lore, or any other write tool with a
  content-bearing argument), pass the FULL intended final content as that tool argument, not just a diff or a
  description of the change. The proposal card the user reviews is rendered purely from the arguments you pass
  — it does NOT read your chat reply. Writing the content out in your chat reply instead of (or in addition to)
  the tool argument does not count: the user will see an empty or stale diff and, if they approve it, an empty
  or stale overwrite. Never describe content you didn't actually put in the argument.
- When the intent is to UPDATE an existing story or lore entry (including "@thisStory"/"@thisLore", or anything
  you already have a public_id for from storyteller_get_story/get_lore/list_stories/list_lores), you MUST pass
  that story_public_id/lore_public_id back in the upsert call. Omitting it does not mean "keep everything else
  the same" — it means "create a brand new, separate item" — so leaving it out when you meant to update silently
  creates a duplicate instead, and the user's edit area won't show any change at all.
- After proposing one or more writes, tell the user in your final answer what you've prepared for them to
  review; never claim a write has already been applied.
- If a tool call fails or returns unexpected data, explain what you tried and continue with the best answer
  you can give, don't just give up silently.`

	promptReferenceSyntax = `Reference syntax — the user's <Task> may contain "@" references that the frontend does not expand for you;
resolve them yourself with tools when the task needs their content:
- "@thisStory" means the story currently open in the editor (only meaningful when <Context> says the target is
  a story) — call storyteller_get_story with its target_public_id to read it.
- "@thisLore" means the lore/worldbuilding entry currently open in the editor (only meaningful when <Context>
  says the target is a lore entry) — call storyteller_get_lore with its target_public_id to read it.
- "@story:<title>" or "@story:[title]" refers to a story by title — call storyteller_list_stories to find the
  one whose title matches, then storyteller_get_story to read it. If nothing matches closely, say so instead of
  guessing.
- "@lore:<title>" or "@lore:[title]" refers to a lore/worldbuilding entry by title — same pattern with
  storyteller_list_lores and storyteller_get_lore.
- Only resolve a reference if the task actually needs its content; don't fetch every reference reflexively.`

	// 一般對話的回答會顯示在 chat UI，UI 會把這個語法轉成可點的連結；skill 的輸出是要放回
	// 故事內文的，絕對不能混進這種語法，所以限定在「沒有 <Skill>」的對話回答。
	promptReferenceLinkBack = `- In a conversational answer (a request without <Skill>), when YOUR OWN final answer mentions a specific story
  or lore entry by name, refer to it using this same syntax — "@thisStory"/"@thisLore" for the one currently
  open, or "@story:[exact title]"/"@lore:[exact title]" for any other one (copy the title exactly, including
  any brackets in it, between the square brackets) — instead of just writing the bare title as plain text. The
  chat UI turns this syntax into a clickable link straight to that item. Never use this syntax inside text
  produced for a <Skill>: that text is placed directly into the story.`

	// skillCommonPrompt 是所有內建 skill 共用的輸出原則，放在 <Skill> 裡，各 skill 的專屬輸出
	// 要求（agentSkills[mode].OutputRule）接在後面。
	skillCommonPrompt = `Help the user process story text. Unless the user asks for analysis, output content that can be placed directly back into the story. Do not include unrelated prefaces, conclusions, or explanations.`
)

func agentSystemPrompt(tools agentToolPolicy) string {
	var b strings.Builder
	b.WriteString(promptRole)
	if tools == agentToolsProposeWrites {
		b.WriteString(promptProposeWritesIntro)
	}
	b.WriteString("\n\n" + promptRequestFormat + "\n\nRules:\n" + promptRuleSensitive)
	switch tools {
	case agentToolsReadOnly:
		b.WriteString("\n" + promptRuleProjectScope + "\n" + promptRuleReadOnlyTools)
	case agentToolsProposeWrites:
		b.WriteString("\n" + promptRuleProjectScope + "\n" + promptRulesProposeWrites)
	}
	if tools != agentToolsNone {
		b.WriteString("\n\n" + promptReferenceSyntax)
		if tools == agentToolsProposeWrites {
			b.WriteString("\n" + promptReferenceLinkBack)
		}
	}
	return b.String()
}

// agentSkillSpec 是一個內建 skill（/rewrite 等）的資料化描述。新增 skill 只要在
// agentSkills 加一筆，驗證、是否需要選取文字、輸出要求都跟著走，不用再改 switch。
type agentSkillSpec struct {
	NeedSelection bool   // 是否針對選取文字操作（沒選取時退回用全文當上下文）
	OutputRule    string // 附在 user prompt 的 Output requirements
}

var agentSkills = map[storytellerModel.AgentRunMode]agentSkillSpec{
	storytellerModel.AgentRunModeRewriteSelection: {
		NeedSelection: true,
		OutputRule:    "Only output the rewritten text. Do not list versions or explain changes. Preserve the original tone and Markdown structure.",
	},
	storytellerModel.AgentRunModeExpandSelection: {
		NeedSelection: true,
		OutputRule:    "Only output the expanded text. Do not explain changes. Continue the original tone and point of view.",
	},
	storytellerModel.AgentRunModeTranslateSelection: {
		NeedSelection: true,
		OutputRule:    "Only output the translated text without notes. Infer the target language from the user instruction; if unspecified, translate to Traditional Chinese.",
	},
	storytellerModel.AgentRunModeCustomSelection: {
		NeedSelection: true,
		OutputRule:    "Follow the user instruction. If analysis is not requested, output text that can be directly applied to the story.",
	},
	storytellerModel.AgentRunModeContinueChapter: {
		OutputRule: "Only output new content that can continue after the current chapter ending. Do not repeat the full chapter.",
	},
}
