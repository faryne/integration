import { steamloomPath } from "@/helpers/steamloom.ts";

export type StorytellerAgentReferenceKind = "story" | "lore";

export interface StorytellerAgentReferenceSource {
  kind: StorytellerAgentReferenceKind;
  id: string;
  title: string;
  content: string;
}

export interface StorytellerAgentReference {
  token: string;
  kind: StorytellerAgentReferenceKind;
  title: string;
  content: string;
}

interface ResolveAgentReferencesInput {
  prompt: string;
  currentStory?: StorytellerAgentReferenceSource | null;
  currentLore?: StorytellerAgentReferenceSource | null;
  stories: StorytellerAgentReferenceSource[];
  lores: StorytellerAgentReferenceSource[];
}

interface ParsedReferenceToken {
  token: string;
  kind: StorytellerAgentReferenceKind;
  title: string;
}

export function formatStorytellerAgentReferenceToken(
  kind: StorytellerAgentReferenceKind,
  title: string,
) {
  const prefix = kind === "lore" ? "@lore" : "@story";
  return `${prefix}:[${escapeStorytellerAgentReferenceTitle(title)}]`;
}

export interface StorytellerAgentPromptSegment {
  text: string;
  // "current" 是 @thisStory／@thisLore；"named" 是 @story:[...]／@lore:[...]。
  // 兩者純粹是語法辨識，不代表當下真的解得出對應的故事/設定集——輸入框疊層
  // highlight 只是視覺提示「這段被認得是引用語法」，語意上有效與否留給送出
  // 後端去判斷。
  kind: "current" | "named" | null;
}

// 把整段輸入文字切成「一般文字」跟「引用 token」的交錯片段，給輸入框疊層
// highlight 用。純粹掃描語法（@thisStory／@thisLore／@story:.../@lore:...），
// 不管當下解不解得出真正的故事/設定集——那個判斷留給送出後的後端。
export function segmentStorytellerAgentPromptForHighlight(
  prompt: string,
): StorytellerAgentPromptSegment[] {
  const segments: StorytellerAgentPromptSegment[] = [];
  let plainStart = 0;
  let index = 0;
  while (index < prompt.length) {
    const token = matchHighlightTokenAt(prompt, index);
    if (!token) {
      index += 1;
      continue;
    }
    if (index > plainStart) {
      segments.push({ text: prompt.slice(plainStart, index), kind: null });
    }
    segments.push({ text: token.text, kind: token.kind });
    index += token.text.length;
    plainStart = index;
  }
  if (plainStart < prompt.length || segments.length === 0) {
    segments.push({ text: prompt.slice(plainStart), kind: null });
  }
  return segments;
}

function matchHighlightTokenAt(
  prompt: string,
  start: number,
): { text: string; kind: "current" | "named" } | null {
  if (prompt.startsWith("@thisStory", start)) {
    return { text: "@thisStory", kind: "current" };
  }
  if (prompt.startsWith("@thisLore", start)) {
    return { text: "@thisLore", kind: "current" };
  }
  const storyToken = parseReferenceTokenAt(prompt, start, "story");
  if (storyToken) {
    return { text: storyToken.token, kind: "named" };
  }
  const loreToken = parseReferenceTokenAt(prompt, start, "lore");
  if (loreToken) {
    return { text: loreToken.token, kind: "named" };
  }
  return null;
}

export interface StorytellerAgentReferenceLinkContext {
  currentKind?: StorytellerAgentReferenceKind | null;
  currentHref?: string | null;
  storyHrefByTitle?: Map<string, string>;
  loreHrefByTitle?: Map<string, string>;
}

// 把訊息文字裡的 @thisStory／@thisLore／@story:[...]／@lore:[...] 換成真的
// markdown 連結語法，解析不出對應目標（例如標題比對不到、或 @thisLore 出現在
// 故事編輯頁）就照原樣留著純文字，不做無效連結。呼叫端要在丟給
// <StorytellerMarkdown> 之前先跑這個函式。
export function linkifyStorytellerAgentReferenceTokens(
  content: string,
  context: StorytellerAgentReferenceLinkContext,
): string {
  const segments = segmentStorytellerAgentPromptForHighlight(content);
  return segments
    .map((segment) => {
      if (!segment.kind) {
        return segment.text;
      }
      const href = resolveStorytellerAgentReferenceHref(segment, context);
      if (!href) {
        return segment.text;
      }
      return `[${segment.text}](${href})`;
    })
    .join("");
}

function resolveStorytellerAgentReferenceHref(
  segment: StorytellerAgentPromptSegment,
  context: StorytellerAgentReferenceLinkContext,
): string | null {
  if (segment.kind === "current") {
    if (segment.text === "@thisStory" && context.currentKind === "story") {
      return context.currentHref ?? null;
    }
    if (segment.text === "@thisLore" && context.currentKind === "lore") {
      return context.currentHref ?? null;
    }
    return null;
  }
  const parsed = parseNamedReferenceTitle(segment.text);
  if (!parsed) {
    return null;
  }
  const table =
    parsed.kind === "lore" ? context.loreHrefByTitle : context.storyHrefByTitle;
  return table?.get(parsed.title) ?? null;
}

export interface StorytellerAgentMessageLinkOptions {
  targetKind: StorytellerAgentReferenceKind;
  projectPublicId?: string;
  targetPublicId?: string;
  otherStories: { id: string; title: string }[];
  lores: { id: string; title: string }[];
}

// linkifyStorytellerAgentReferenceTokens 的高階版本——直接吃面板現有的
// targetKind／projectPublicId／targetPublicId／otherStories／lores 這幾個既有
// prop，自己組出對應的 steamloomPath 網址，呼叫端（訊息泡泡元件）不用自己重複
//組 Map。@thisStory／@thisLore 指向面板目前的 targetKind/targetPublicId；
// @story:[標題]／@lore:[標題] 依標題比對 otherStories／lores（比對不到就照原樣
//留純文字，不當連結）。
export function buildStorytellerAgentMessageLinks(
  content: string,
  options: StorytellerAgentMessageLinkOptions,
): string {
  if (!options.projectPublicId) {
    return content;
  }
  const storyHrefByTitle = new Map(
    options.otherStories.map((story) => [
      story.title,
      steamloomPath(`my/project/${options.projectPublicId}/story/${story.id}`),
    ]),
  );
  const loreHrefByTitle = new Map(
    options.lores.map((lore) => [
      lore.title,
      steamloomPath(`my/project/${options.projectPublicId}/lore/${lore.id}`),
    ]),
  );
  const currentHref = options.targetPublicId
    ? steamloomPath(
        `my/project/${options.projectPublicId}/${options.targetKind}/${options.targetPublicId}`,
      )
    : null;
  return linkifyStorytellerAgentReferenceTokens(content, {
    currentKind: options.targetKind,
    currentHref,
    storyHrefByTitle,
    loreHrefByTitle,
  });
}

function parseNamedReferenceTitle(
  token: string,
): { kind: StorytellerAgentReferenceKind; title: string } | null {
  const storyToken = parseReferenceTokenAt(token, 0, "story");
  if (storyToken) {
    return { kind: "story", title: storyToken.title };
  }
  const loreToken = parseReferenceTokenAt(token, 0, "lore");
  if (loreToken) {
    return { kind: "lore", title: loreToken.title };
  }
  return null;
}

export function resolveStorytellerAgentReferences(
  input: ResolveAgentReferencesInput,
) {
  const references = new Map<string, StorytellerAgentReference>();
  if (input.currentStory && input.prompt.includes("@thisStory")) {
    references.set("@thisStory", {
      token: "@thisStory",
      kind: "story",
      title: input.currentStory.title,
      content: input.currentStory.content,
    });
  }
  if (input.currentLore && input.prompt.includes("@thisLore")) {
    references.set("@thisLore", {
      token: "@thisLore",
      kind: "lore",
      title: input.currentLore.title,
      content: input.currentLore.content,
    });
  }

  const storySources = new Map(
    input.stories.map((story) => [story.title, story]),
  );
  const loreSources = new Map(input.lores.map((lore) => [lore.title, lore]));
  for (const token of parseStorytellerAgentReferenceTokens(input.prompt)) {
    const source =
      token.kind === "lore"
        ? loreSources.get(token.title)
        : storySources.get(token.title);
    if (!source) {
      continue;
    }
    references.set(token.token, {
      token: token.token,
      kind: source.kind,
      title: source.title,
      content: source.content,
    });
  }
  return Array.from(references.values());
}

export function buildStorytellerAgentReferenceContent(
  references: StorytellerAgentReference[],
) {
  return references
    .map((reference) => {
      const label = reference.kind === "lore" ? "lore" : "story";
      const fence =
        reference.kind === "lore"
          ? "LORE_REFERENCE_CONTENT"
          : "STORY_REFERENCE_CONTENT";
      return `Reference ${label}: ${reference.title}\nToken: ${reference.token}\n<<<${fence}\n${reference.content}\n${fence}`;
    })
    .join("\n\n");
}

export interface StorytellerAgentReplyTarget {
  id: string;
  speaker: string;
  content: string;
}

export function buildStorytellerAgentReplyReferenceContent(
  reply: StorytellerAgentReplyTarget | null | undefined,
) {
  if (!reply || reply.content.trim() === "") {
    return "";
  }
  return `Reference reply: ${reply.speaker}\n<<<REPLY_REFERENCE_CONTENT\n${reply.content}\nREPLY_REFERENCE_CONTENT`;
}

const storytellerAgentReplyQuoteSummaryMaxCharacters = 60;

// 把回覆目標摘要成一行 markdown blockquote，讓對話列表（不論是剛送出的樂觀訊息，
// 或之後重新載入的歷史紀錄）都能看出這則訊息是在回覆誰，而不用改後端 schema——
// 這段文字會直接併入 instruction 送出，後端會原封不動存成訊息內容。
export function buildStorytellerAgentReplyQuote(
  reply: StorytellerAgentReplyTarget | null | undefined,
) {
  if (!reply || reply.content.trim() === "") {
    return "";
  }
  const summary = summarizeStorytellerAgentReplyContent(reply.content);
  return `> 回覆 ${reply.speaker}：${summary}`;
}

export function composeStorytellerAgentInstructionWithReply(
  instruction: string,
  reply: StorytellerAgentReplyTarget | null | undefined,
) {
  const quote = buildStorytellerAgentReplyQuote(reply);
  if (!quote) {
    return instruction;
  }
  return instruction.trim() ? `${quote}\n\n${instruction}` : quote;
}

function summarizeStorytellerAgentReplyContent(
  content: string,
  maxLength = storytellerAgentReplyQuoteSummaryMaxCharacters,
) {
  const singleLine = content.replace(/\s+/g, " ").trim();
  const characters = Array.from(singleLine);
  if (characters.length <= maxLength) {
    return singleLine;
  }
  return `${characters.slice(0, maxLength).join("")}…`;
}

function escapeStorytellerAgentReferenceTitle(title: string) {
  return title.replace(/\\/g, "\\\\").replace(/\]/g, "\\]");
}

function parseStorytellerAgentReferenceTokens(prompt: string) {
  const tokens: ParsedReferenceToken[] = [];
  for (let index = 0; index < prompt.length; index += 1) {
    // 集中解析 bracket token，避免標題含空白或中括號時被錯誤切割。
    const storyToken = parseReferenceTokenAt(prompt, index, "story");
    if (storyToken) {
      tokens.push(storyToken);
      index += storyToken.token.length - 1;
      continue;
    }
    const loreToken = parseReferenceTokenAt(prompt, index, "lore");
    if (loreToken) {
      tokens.push(loreToken);
      index += loreToken.token.length - 1;
    }
  }
  return tokens;
}

function parseReferenceTokenAt(
  prompt: string,
  start: number,
  kind: StorytellerAgentReferenceKind,
): ParsedReferenceToken | null {
  const prefix = kind === "lore" ? "@lore:" : "@story:";
  if (!prompt.startsWith(prefix, start)) {
    return null;
  }
  const titleStart = start + prefix.length;
  if (prompt[titleStart] === "[") {
    return parseBracketReferenceToken(prompt, start, kind, titleStart + 1);
  }
  return parseLegacyReferenceToken(prompt, start, kind, titleStart);
}

function parseBracketReferenceToken(
  prompt: string,
  start: number,
  kind: StorytellerAgentReferenceKind,
  titleStart: number,
): ParsedReferenceToken | null {
  let title = "";
  // 這個 repo 的故事/設定集標題很常見「[N] 第X話 ...」這種本身就帶一組方括號的
  // 命名慣例，標題內的方括號沒有理由要求使用者或 AI 自己跳脫——用深度計數：
  // 標題內部每多一個「[」深度+1，對應的「]」只是把深度打平，只有深度回到 0
  // 的那個「]」才是真正結束 @story:[...] 的那一個。escapeStorytellerAgentReferenceTitle
  // 產生的 "\]" 跳脫寫法依然照舊支援（用來處理真的沒有配對、單獨一個「]」的
  // 極端標題），兩種寫法都能正確解析。
  let depth = 0;
  for (let index = titleStart; index < prompt.length; index += 1) {
    const char = prompt[index];
    if (char === "\\") {
      const nextChar = prompt[index + 1];
      if (nextChar === undefined) {
        title += char;
        continue;
      }
      title += nextChar;
      index += 1;
      continue;
    }
    if (char === "[") {
      depth += 1;
      title += char;
      continue;
    }
    if (char === "]") {
      if (depth > 0) {
        depth -= 1;
        title += char;
        continue;
      }
      return {
        token: prompt.slice(start, index + 1),
        kind,
        title,
      };
    }
    title += char;
  }
  return null;
}

function parseLegacyReferenceToken(
  prompt: string,
  start: number,
  kind: StorytellerAgentReferenceKind,
  titleStart: number,
): ParsedReferenceToken | null {
  let end = titleStart;
  while (end < prompt.length && !/[\s\]]/.test(prompt[end])) {
    end += 1;
  }
  if (end === titleStart) {
    return null;
  }
  return {
    token: prompt.slice(start, end),
    kind,
    title: prompt.slice(titleStart, end),
  };
}
