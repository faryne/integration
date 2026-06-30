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
    if (char === "]") {
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
