export type StorytellerMarkdownAlign = "left" | "center" | "right";

export interface StorytellerMarkdownSegment {
  align?: StorytellerMarkdownAlign;
  content: string;
  subscript?: boolean;
}

export interface AllowedHtmlBlockRule {
  description: string;
  label: string;
  regexp: RegExp;
  syntaxExamples: string[];
  toSegment: (match: RegExpMatchArray) => StorytellerMarkdownSegment;
}

export const allowedHtmlBlockRules: AllowedHtmlBlockRule[] = [
  {
    description:
      "只允許 left、center、right 三種對齊值，區塊內文字仍會繼續解析 Markdown。",
    label: "文字對齊",
    regexp:
      /<div\s+align=(?:"|')?(left|center|right)(?:"|')?>\s*([\s\S]*?)\s*<\/div>/gi,
    syntaxExamples: [
      '<div align="left">\n文字\n</div>',
      '<div align="center">\n文字\n</div>',
      '<div align="right">\n文字\n</div>',
    ],
    toSegment: (match) => ({
      align: match[1].toLowerCase() as StorytellerMarkdownAlign,
      content: match[2],
    }),
  },
  {
    description: "只輸出純文字底標，不會在底標內容內解析其他 HTML。",
    label: "底標",
    regexp: /<sub>\s*([\s\S]*?)\s*<\/sub>/gi,
    syntaxExamples: ["<sub>底標文字</sub>"],
    toSegment: (match) => ({
      content: match[1],
      subscript: true,
    }),
  },
];

export function storytellerMarkdownSegments(
  content: string,
): StorytellerMarkdownSegment[] {
  const segments: StorytellerMarkdownSegment[] = [];
  let cursor = 0;
  const matches = allowedHtmlBlockRules
    .flatMap((rule) =>
      Array.from(content.matchAll(rule.regexp), (match) => ({
        index: match.index ?? 0,
        length: match[0].length,
        segment: rule.toSegment(match),
      })),
    )
    .sort((left, right) => left.index - right.index);

  for (const match of matches) {
    if (match.index < cursor) {
      continue;
    }
    if (match.index > cursor) {
      segments.push({ content: content.slice(cursor, match.index) });
    }
    segments.push(match.segment);
    cursor = match.index + match.length;
  }
  if (cursor < content.length) {
    segments.push({ content: content.slice(cursor) });
  }
  return segments.length > 0 ? segments : [{ content }];
}
