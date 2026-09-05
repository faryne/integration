import type { ReactNode } from "react";
import bash from "highlight.js/lib/languages/bash";
import css from "highlight.js/lib/languages/css";
import go from "highlight.js/lib/languages/go";
import javascript from "highlight.js/lib/languages/javascript";
import json from "highlight.js/lib/languages/json";
import perl from "highlight.js/lib/languages/perl";
import php from "highlight.js/lib/languages/php";
import python from "highlight.js/lib/languages/python";
import ruby from "highlight.js/lib/languages/ruby";
import rust from "highlight.js/lib/languages/rust";
import sql from "highlight.js/lib/languages/sql";
import typescript from "highlight.js/lib/languages/typescript";
import xml from "highlight.js/lib/languages/xml";
import yaml from "highlight.js/lib/languages/yaml";
import { createLowlight } from "lowlight";

export const STORYTELLER_CODE_BLOCK_LANGUAGES = [
  "go",
  "typescript",
  "javascript",
  "python",
  "json",
  "bash",
  "yaml",
  "sql",
  "html",
  "css",
  "ruby",
  "perl",
  "rust",
  "php",
  "xml",
] as const;

export type StorytellerCodeBlockLanguage =
  (typeof STORYTELLER_CODE_BLOCK_LANGUAGES)[number];

export interface StorytellerCodeBlockToken {
  from: number;
  to: number;
  className: string;
}

interface LowlightNode {
  type: string;
  value?: string;
  properties?: {
    className?: unknown;
  };
  children?: LowlightNode[];
}

export interface StorytellerCodeBlockHighlightTree {
  type: "root";
  children: LowlightNode[];
}

const STORYTELLER_CODE_BLOCK_LANGUAGE_SET = new Set<string>(
  STORYTELLER_CODE_BLOCK_LANGUAGES,
);

const storytellerLowlight = createLowlight();
const xmlWithoutAliases = (...args: Parameters<typeof xml>) => ({
  ...xml(...args),
  aliases: [],
});

// 只註冊 storyteller 已定案的 15 種語言；html/xml 共用 highlight.js 的 xml 文法。
storytellerLowlight.register({
  go,
  typescript,
  javascript,
  python,
  json,
  bash,
  yaml,
  sql,
  html: xmlWithoutAliases,
  css,
  ruby,
  perl,
  rust,
  php,
  xml: xmlWithoutAliases,
});

export function normalizeStorytellerCodeBlockLanguage(
  language: string | null | undefined,
): StorytellerCodeBlockLanguage | null {
  const normalized = (language ?? "").trim().toLowerCase();
  return STORYTELLER_CODE_BLOCK_LANGUAGE_SET.has(normalized)
    ? (normalized as StorytellerCodeBlockLanguage)
    : null;
}

export function highlightStorytellerCodeBlock(
  language: string | null | undefined,
  content: string,
): StorytellerCodeBlockHighlightTree | null {
  const normalizedLanguage = normalizeStorytellerCodeBlockLanguage(language);
  if (!normalizedLanguage) return null;

  try {
    return storytellerLowlight.highlight(
      normalizedLanguage,
      content,
    ) as StorytellerCodeBlockHighlightTree;
  } catch {
    return null;
  }
}

function classNameFromNode(node: LowlightNode): string | null {
  const className = node.properties?.className;
  if (Array.isArray(className)) return className.join(" ").trim() || null;
  if (typeof className === "string") return className.trim() || null;
  return null;
}

function collectHighlightTokens(
  node: LowlightNode,
  offset: number,
  tokens: StorytellerCodeBlockToken[],
): number {
  if (node.type === "text") return offset + (node.value ?? "").length;

  const from = offset;
  let nextOffset = offset;
  for (const child of node.children ?? []) {
    nextOffset = collectHighlightTokens(child, nextOffset, tokens);
  }

  const className = classNameFromNode(node);
  if (className && from < nextOffset) {
    tokens.push({ from, to: nextOffset, className });
  }
  return nextOffset;
}

export function getStorytellerCodeBlockHighlightTokens(
  language: string | null | undefined,
  content: string,
): StorytellerCodeBlockToken[] {
  const tree = highlightStorytellerCodeBlock(language, content);
  if (!tree) return [];

  const tokens: StorytellerCodeBlockToken[] = [];
  collectHighlightTokens(tree, 0, tokens);
  return tokens;
}

function renderHighlightNode(node: LowlightNode, key: string): ReactNode {
  if (node.type === "text") return node.value ?? "";

  return (
    <span key={key} className={classNameFromNode(node) ?? undefined}>
      {(node.children ?? []).map((child, index) =>
        renderHighlightNode(child, `${key}-${index}`),
      )}
    </span>
  );
}

export function renderStorytellerCodeBlockHighlight(
  language: string | null | undefined,
  content: string,
): ReactNode | null {
  const tree = highlightStorytellerCodeBlock(language, content);
  if (!tree) return null;

  return tree.children.map((child, index) =>
    renderHighlightNode(child, `code-token-${index}`),
  );
}
