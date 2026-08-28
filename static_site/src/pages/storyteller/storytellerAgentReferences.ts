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

// 標題原文直接包一層方括號，不額外跳脫——跟 AI 自己在回覆裡寫引用時的寫法
// （也不跳脫）用同一套規則，靠 parseBracketReferenceToken 的深度計數配對方括
// 號。曾經在這裡跳脫過 [／]，但只跳脫一半（漏了 [）反而讓深度計數對不齊，
// 把整段引用吃壞；跳脫本來就只防得到「標題裡有落單、沒配對的 ]」這種极端情
// 況，而 AI 那條路本來就沒有這層防護，兩邊不統一沒有意義，乾脆都不跳脫。
export function formatStorytellerAgentReferenceToken(
  kind: StorytellerAgentReferenceKind,
  title: string,
) {
  const prefix = kind === "lore" ? "@lore" : "@story";
  return `${prefix}:[${title}]`;
}

export interface StorytellerAgentPromptSegment {
  text: string;
  // "current" 是 @thisStory／@thisLore；"named" 是 @story:[...]／@lore:[...]。
  // 兩者純粹是語法辨識，不代表當下真的解得出對應的故事/設定集——輸入框疊層
  // highlight 只是視覺提示「這段被認得是引用語法」，語意上有效與否留給送出
  // 後端去判斷。
  kind: "current" | "named" | null;
}

export interface StorytellerAgentKnownReferenceTitles {
  storyTitles?: Iterable<string>;
  loreTitles?: Iterable<string>;
}

// 把整段輸入文字切成「一般文字」跟「引用 token」的交錯片段。純掃語法
// （@thisStory／@thisLore／@story:.../@lore:...）給輸入框疊層 highlight 用時，
// 不用帶 knownTitles，不管當下解不解得出真正的故事/設定集——那個判斷留給送出
// 後的後端。
//
// 解析對話內容（AI 自己寫的回覆）要準確連到正確目標時，帶 knownTitles——AI
// 不一定每次都照最嚴謹的格式包方括號（例如標題本身已經是「[N] 第三話...」開頭，
// AI 有時會直接寫 @story:[N] 第三話...]，把標題自己的「[」當語法的外層括號在
// 用，等於少包一層，純語法解析猜不出正確邊界）。有候選標題清單時優先拿清單去
// 比對「這個位置開始的文字剛好完整等於某個已知標題」，兩種包法（多包一層／
// 少包一層）都比對得到；比對不到才退回純語法解析當保底。
export function segmentStorytellerAgentPromptForHighlight(
  prompt: string,
  knownTitles?: StorytellerAgentKnownReferenceTitles,
): StorytellerAgentPromptSegment[] {
  const storyTitles = knownTitles?.storyTitles
    ? [...knownTitles.storyTitles].sort((a, b) => b.length - a.length)
    : [];
  const loreTitles = knownTitles?.loreTitles
    ? [...knownTitles.loreTitles].sort((a, b) => b.length - a.length)
    : [];
  const segments: StorytellerAgentPromptSegment[] = [];
  let plainStart = 0;
  let index = 0;
  while (index < prompt.length) {
    const token = matchHighlightTokenAt(prompt, index, storyTitles, loreTitles);
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
  storyTitles: string[],
  loreTitles: string[],
): { text: string; kind: "current" | "named" } | null {
  const match = matchHighlightTokenCandidate(prompt, start, storyTitles, loreTitles);
  if (!match) {
    return null;
  }
  // AI 有時候會直接自己寫出完整的 markdown 連結，例如
  // [@thisStory](/my/project/.../story/...)——這種情況 token 本身已經是連結的
  // label，前面緊接著 "["、後面緊接著 "]("。這裡如果照樣再包一層
  // linkifyStorytellerAgentReferenceTokens 的 [token](href)，會產生巢狀連結
  // （[[@thisStory](newHref)](原本的url)），CommonMark 不允許巢狀連結標籤，
  // react-markdown 解析失敗就整段退回顯示成純文字（使用者看到的「連結沒生
  // 效」）。偵測到這個情況直接跳過，讓 AI 自己寫好的連結原封不動交給
  // <StorytellerMarkdown> 處理。
  const end = start + match.text.length;
  const alreadyInsideMarkdownLink =
    prompt[start - 1] === "[" && prompt.slice(end, end + 2) === "](";
  if (alreadyInsideMarkdownLink) {
    return null;
  }
  return match;
}

function matchHighlightTokenCandidate(
  prompt: string,
  start: number,
  storyTitles: string[],
  loreTitles: string[],
): { text: string; kind: "current" | "named" } | null {
  if (prompt.startsWith("@thisStory", start)) {
    return { text: "@thisStory", kind: "current" };
  }
  if (prompt.startsWith("@thisLore", start)) {
    return { text: "@thisLore", kind: "current" };
  }
  const storyByTitle = matchKnownReferenceTitleAt(prompt, start, "story", storyTitles);
  if (storyByTitle) {
    return { text: storyByTitle, kind: "named" };
  }
  const loreByTitle = matchKnownReferenceTitleAt(prompt, start, "lore", loreTitles);
  if (loreByTitle) {
    return { text: loreByTitle, kind: "named" };
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

// titles 已經照長度由長到短排序，回傳第一個（最長）比對成功的完整 token 文字。
// 兩種包法都試：@story:[title]（title 可能自己也帶方括號）跟 @story:title
// （沒有額外包一層，title 開頭剛好是方括號時常見 AI 寫成這樣）。
function matchKnownReferenceTitleAt(
  prompt: string,
  start: number,
  kind: StorytellerAgentReferenceKind,
  titles: string[],
): string | null {
  if (titles.length === 0) {
    return null;
  }
  const prefix = kind === "lore" ? "@lore:" : "@story:";
  if (!prompt.startsWith(prefix, start)) {
    return null;
  }
  const titleStart = start + prefix.length;
  const bracketTitleStart =
    prompt[titleStart] === "[" ? titleStart + 1 : null;
  for (const title of titles) {
    if (bracketTitleStart !== null) {
      const end = bracketTitleStart + title.length;
      if (
        prompt.slice(bracketTitleStart, end) === title &&
        prompt[end] === "]"
      ) {
        return prompt.slice(start, end + 1);
      }
    }
    const bareEnd = titleStart + title.length;
    if (prompt.slice(titleStart, bareEnd) === title) {
      // AI 少包一層方括號時，常常還是會在標題後面留一個多餘的「]」（把標題自己
      // 的「[」誤當成語法括號在用留下的痕跡）——有的話一併吃掉，畫面上才不會
      // 在連結後面多一個孤零零的「]」。
      const hasStrayClosingBracket = prompt[bareEnd] === "]";
      return prompt.slice(start, hasStrayClosingBracket ? bareEnd + 1 : bareEnd);
    }
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
  const segments = segmentStorytellerAgentPromptForHighlight(content, {
    storyTitles: context.storyHrefByTitle?.keys(),
    loreTitles: context.loreHrefByTitle?.keys(),
  });
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
  // 用 my/workspace/...（ProjectWorkspacePreview 內嵌同一個 StorytellerStoryEditor／
  // StorytellerLoreEditor，畫面內容一致，只是多包一層 Notion 風工作台外殼）而不是
  // my/project/...：後者是遷移前的獨立頁面路由，之後會逐步淘汰，AI 助理產生的連結
  // 直接對齊目前主要的導覽路徑。
  const storyHrefByTitle = new Map(
    options.otherStories.map((story) => [
      story.title,
      steamloomPath(`my/workspace/${options.projectPublicId}/story/${story.id}`),
    ]),
  );
  const loreHrefByTitle = new Map(
    options.lores.map((lore) => [
      lore.title,
      steamloomPath(`my/workspace/${options.projectPublicId}/lore/${lore.id}`),
    ]),
  );
  const currentHref = options.targetPublicId
    ? steamloomPath(
        `my/workspace/${options.projectPublicId}/${options.targetKind}/${options.targetPublicId}`,
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
  // 的那個「]」才是真正結束 @story:[...] 的那一個。App 插入引用時（見
  // formatStorytellerAgentReferenceToken）跟 AI 自己回覆時寫的引用都不跳脫，
  // 統一走這條路；"\[" "\]" 反斜線跳脫寫法還是照舊支援解析（防的是標題裡真的
  // 有落單、沒配對的方括號那種極端情況），只是現在沒有任何地方會主動產生它。
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
