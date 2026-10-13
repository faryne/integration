import { parseMarkdownToParagraphs } from "@/pages/storyteller/wysiwygCore/parser.ts";

// 字數只算段落實際文字，不含 marker id／comment 屬性／標題與對齊語法的符號——
// 故事與設定編輯器（含 SteamLoom Writer）的字數顯示、「離開頁面前要不要示警」的空白判斷都靠這個共用。
export function contentWordCount(content: string) {
  const cleanText = parseMarkdownToParagraphs(content)
    .flatMap((paragraph) => paragraph.runs)
    .map((run) => run.text)
    .join("");
  return cleanText.replace(/\s+/g, "").length;
}
